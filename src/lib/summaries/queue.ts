import { randomUUID } from "crypto";
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries, journalEntrySummaries } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { generateSummary, SUMMARISER_VERSION } from "./generate";

/**
 * The summarisation work queue.
 *
 * ── There is no status column ─────────────────────────────────────────────────
 * Work is derived by joining entries against their summaries. An entry is due
 * when it is complete and either has no summary, or has one generated before its
 * own `updated_at`.
 *
 * That second clause IS the regeneration rule. Editing a completed entry bumps
 * `updated_at`, which makes the existing summary stale by construction — there
 * is no flag to set and no way to forget to set it. It also means a run that
 * dies halfway simply leaves work due, rather than leaving rows stuck in a
 * "running" state that something has to clean up.
 *
 * ── Why a cron worker and not after() ─────────────────────────────────────────
 * 1. Edit coalescing. Five saves to a completed entry would be five AI calls
 *    under after(); here the entry is due once and summarised once.
 * 2. Retries. A transient API failure under after() means the entry silently
 *    never gets a summary. Here the next run picks it up.
 * 3. Completing an entry must not depend on Anthropic twice. The PATCH already
 *    awaits classification because the tier drives the crisis panel; a second
 *    call in that path doubles the failure surface for something nobody sees.
 */

/** Retries stop here. Reset to 0 on success or on any edit to the entry. */
export const SUMMARY_MAX_ATTEMPTS = 5;

/** Bounded so one run fits comfortably inside the function's maxDuration. */
export const SUMMARY_BATCH_SIZE = 25;

/** Concurrent Haiku calls. Low enough to stay far from any rate limit. */
const CONCURRENCY = 3;

export type SummaryRunResult = {
  due: number;
  succeeded: number;
  failed: number;
  skipped: number;
  exhausted: string[];
};

/**
 * Entries needing a summary, oldest first.
 *
 * Purged entries are excluded because their body is gone; trashed ones because
 * summarising something on its way to destruction is wasted spend. A restored
 * entry becomes due again automatically — restore bumps `updated_at`.
 */
export async function findDue(limit = SUMMARY_BATCH_SIZE) {
  return db
    .select({
      id: journalEntries.id,
      encryptedBody: journalEntries.encryptedBody,
      attempts: journalEntries.summaryAttempts,
      summaryId: journalEntrySummaries.id,
    })
    .from(journalEntries)
    .leftJoin(
      journalEntrySummaries,
      eq(journalEntrySummaries.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        isNotNull(journalEntries.completedAt),
        isNotNull(journalEntries.encryptedBody),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt),
        lt(journalEntries.summaryAttempts, SUMMARY_MAX_ATTEMPTS),
        or(
          isNull(journalEntrySummaries.id),
          lt(journalEntrySummaries.generatedAt, journalEntries.updatedAt)
        )
      )
    )
    .orderBy(asc(journalEntries.completedAt))
    .limit(limit);
}

/**
 * Summarises one entry and upserts the result.
 *
 * The upsert targets the unique constraint on `journal_entry_id`, so a
 * regenerated summary replaces the old one on the same row. Cabinet 2 is derived
 * data — the current summary must describe the current text, and keeping
 * superseded summaries would mean deciding which is authoritative every time
 * anything reads them.
 */
async function summariseOne(entry: {
  id: string;
  encryptedBody: string | null;
  attempts: number;
}): Promise<"succeeded" | "failed"> {
  try {
    if (!entry.encryptedBody) throw new Error("no body");
    const body = decrypt(entry.encryptedBody);
    const summary = await generateSummary(body);

    await db
      .insert(journalEntrySummaries)
      .values({
        id: randomUUID(),
        journalEntryId: entry.id,
        encryptedContent: encrypt(JSON.stringify(summary)),
        generatedAt: new Date(),
        generationVersion: SUMMARISER_VERSION,
      })
      .onConflictDoUpdate({
        target: journalEntrySummaries.journalEntryId,
        set: {
          encryptedContent: encrypt(JSON.stringify(summary)),
          generatedAt: new Date(),
          generationVersion: SUMMARISER_VERSION,
        },
      });

    await db
      .update(journalEntries)
      .set({ summaryAttempts: 0 })
      .where(eq(journalEntries.id, entry.id));

    return "succeeded";
  } catch (err) {
    // The entry id is safe to log; its content is not, and neither is anything
    // the model returned about it.
    console.error(
      `Summary failed for entry ${entry.id} (attempt ${entry.attempts + 1}):`,
      err instanceof Error ? err.message : "unknown error"
    );

    // Incremented in SQL rather than from the value read at query time, so two
    // overlapping runs cannot both write attempts = n + 1.
    await db
      .update(journalEntries)
      .set({ summaryAttempts: sql`${journalEntries.summaryAttempts} + 1` })
      .where(eq(journalEntries.id, entry.id));

    return "failed";
  }
}

/**
 * One pass of the queue. Safe to call twice concurrently: the worst case is
 * duplicated work, not duplicated rows, because the upsert is keyed on the
 * entry and attempts increment atomically.
 */
export async function runSummaryQueue(
  limit = SUMMARY_BATCH_SIZE
): Promise<SummaryRunResult> {
  const due = await findDue(limit);

  const result: SummaryRunResult = {
    due: due.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    exhausted: [],
  };

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const slice = due.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(slice.map(summariseOne));

    outcomes.forEach((outcome, j) => {
      if (outcome === "succeeded") result.succeeded += 1;
      else {
        result.failed += 1;
        // This attempt was the last one it will get without an edit.
        if (slice[j].attempts + 1 >= SUMMARY_MAX_ATTEMPTS) {
          result.exhausted.push(slice[j].id);
        }
      }
    });
  }

  return result;
}
