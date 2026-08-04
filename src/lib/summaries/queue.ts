import { randomUUID } from "crypto";
import { and, asc, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
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
 * ── Why cron AS WELL AS on-submit ─────────────────────────────────────────────
 * Summarisation is triggered when an entry is marked done, from the PATCH in
 * src/app/api/reflections/[id]/route.ts via `summariseEntryById()` below. The
 * cron did that job alone until 2026-08-04; it is now the backstop.
 *
 * What the cron still covers, and why it cannot be deleted:
 * 1. Retries. A transient Anthropic failure under after() means the entry
 *    silently never gets a summary. The failed attempt leaves it due, and the
 *    next run picks it up.
 * 2. Autosave edits. A debounced PUT to a completed entry bumps `updated_at`
 *    without going through PATCH, so it is caught here rather than costing an
 *    AI call per keystroke pause.
 * 3. Prompt-version reflow — see below. Nothing else walks the whole archive.
 *
 * What was traded away, deliberately: edit coalescing. Five saves to a completed
 * entry are now five AI calls where the cron would have summarised once. The
 * PATCH short-circuits when the body is byte-identical, which removes the
 * accidental half of that; the rest is the price of the summary being there when
 * the entry is still fresh in mind.
 *
 * Note that the PATCH does NOT await this. It already awaits classification
 * because the tier drives the crisis panel; adding a second blocking Anthropic
 * call would double the failure surface of finishing an entry.
 *
 * ── Prompt changes reflow automatically ───────────────────────────────────────
 * An entry is also due when its summary was generated under a different prompt
 * version. Editing `entry-summariser.md` therefore re-summarises the whole
 * archive, 25 a day, with no script to remember and no rows to hand-edit.
 *
 * This is what makes the content pass non-destructive: the prompt can be
 * rewritten against real accumulated entries without stranding weeks of
 * summaries generated under wording that was rejected. Cabinet 2 is derived
 * data, and derived data should follow its deriver.
 */

/**
 * Retries stop here — but per prompt version, not for all time.
 *
 * Reset to 0 on success and on any edit. A version change does not reset the
 * counter; it makes it irrelevant, because `summary_attempt_version` no longer
 * matches and the entry is eligible again. The distinction matters: the count is
 * preserved as a record of what happened under the old prompt, while no longer
 * blocking the new one.
 */
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
 * What makes an entry due, in one place.
 *
 * Shared by the batch query and the single-entry path below so the two cannot
 * drift. Drift here would be quiet and one-directional: a PATCH applying looser
 * rules than the cron would re-summarise entries the cron considers settled, and
 * pay for it every save.
 *
 * Purged entries are excluded because their body is gone; trashed ones because
 * summarising something on its way to destruction is wasted spend. A restored
 * entry becomes due again automatically — restore bumps `updated_at`.
 */
function dueConditions() {
  return [
    isNotNull(journalEntries.completedAt),
    isNotNull(journalEntries.encryptedBody),
    isNull(journalEntries.deletedAt),
    isNull(journalEntries.purgedAt),
    // Exhausted attempts only block while they were spent on the CURRENT
    // prompt. A new prompt version is a new trial.
    or(
      lt(journalEntries.summaryAttempts, SUMMARY_MAX_ATTEMPTS),
      isNull(journalEntries.summaryAttemptVersion),
      ne(journalEntries.summaryAttemptVersion, SUMMARISER_VERSION)
    ),
    or(
      // Never summarised.
      isNull(journalEntrySummaries.id),
      // Entry edited since it was summarised.
      lt(journalEntrySummaries.generatedAt, journalEntries.updatedAt),
      // Summarised under a prompt that no longer exists — reflow.
      ne(journalEntrySummaries.generationVersion, SUMMARISER_VERSION)
    ),
  ];
}

/** The columns `summariseOne` needs, selected identically by both callers. */
const dueColumns = {
  id: journalEntries.id,
  encryptedBody: journalEntries.encryptedBody,
  attempts: journalEntries.summaryAttempts,
  attemptVersion: journalEntries.summaryAttemptVersion,
};

/** Entries needing a summary, oldest first. */
export async function findDue(limit = SUMMARY_BATCH_SIZE) {
  return db
    .select(dueColumns)
    .from(journalEntries)
    .leftJoin(
      journalEntrySummaries,
      eq(journalEntrySummaries.journalEntryId, journalEntries.id)
    )
    .where(and(...dueConditions()))
    .orderBy(asc(journalEntries.completedAt))
    .limit(limit);
}

/**
 * Summarises one entry immediately, if it is due.
 *
 * Called from the PATCH that marks an entry done, inside `after()` — see
 * src/app/api/reflections/[id]/route.ts. Deliberately re-checks eligibility
 * rather than trusting the caller: the entry may have been trashed between the
 * update and this running, or already be current because the body did not
 * actually change.
 *
 * "skipped" is the normal outcome for an entry that needs nothing, not an error.
 *
 * Takes no `userId` and performs no ownership check — like the cron, it operates
 * on entries by id alone. Callers must have established ownership first; the
 * PATCH does, via `loadOwned()`.
 *
 * A failure needs no handling here. `summariseOne` increments
 * `summary_attempts` in SQL, which leaves the entry due, and the cron retries it
 * on its next run up to SUMMARY_MAX_ATTEMPTS.
 */
export async function summariseEntryById(
  id: string
): Promise<"succeeded" | "failed" | "skipped"> {
  const [row] = await db
    .select(dueColumns)
    .from(journalEntries)
    .leftJoin(
      journalEntrySummaries,
      eq(journalEntrySummaries.journalEntryId, journalEntries.id)
    )
    .where(and(eq(journalEntries.id, id), ...dueConditions()))
    .limit(1);

  if (!row) return "skipped";
  return summariseOne(row);
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
  attemptVersion: string | null;
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
      .set({ summaryAttempts: 0, summaryAttemptVersion: null })
      .where(eq(journalEntries.id, entry.id));

    return "succeeded";
  } catch (err) {
    // The entry id is safe to log; its content is not, and neither is anything
    // the model returned about it.
    console.error(
      `Summary failed for entry ${entry.id} (attempt ${entry.attempts + 1}):`,
      err instanceof Error ? err.message : "unknown error"
    );

    // Attempts belong to a prompt version. Failing under a version the counter
    // was not counting starts the count over at 1; failing under the same one
    // increments. Done in SQL rather than from the value read at query time, so
    // two overlapping runs cannot both write attempts = n + 1.
    const sameVersion = entry.attemptVersion === SUMMARISER_VERSION;
    await db
      .update(journalEntries)
      .set({
        summaryAttempts: sameVersion
          ? sql`${journalEntries.summaryAttempts} + 1`
          : 1,
        summaryAttemptVersion: SUMMARISER_VERSION,
      })
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
        const wasSameVersion = slice[j].attemptVersion === SUMMARISER_VERSION;
        const nowAt = wasSameVersion ? slice[j].attempts + 1 : 1;
        if (nowAt >= SUMMARY_MAX_ATTEMPTS) {
          result.exhausted.push(slice[j].id);
        }
      }
    });
  }

  return result;
}
