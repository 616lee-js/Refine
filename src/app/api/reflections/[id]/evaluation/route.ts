import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalEntrySummaries,
  summaryEvaluations,
} from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { authoritativeSummary } from "@/lib/summaries/read";
import { EVAL_SNAPSHOTS_ENABLED, getBooleanSetting } from "@/lib/settings";

/**
 * Recording an assessment of one entry's summary.
 *
 * ── This changes nothing for the person submitting it ─────────────────────────
 * Their future summaries are unaffected. The per-user personalisation direction
 * was dropped 2026-09-24; this is evidence about the summariser, reviewed by the
 * product owner and acted on by hand. Nothing here feeds back into generation,
 * and adding that would be a decision rather than an extension.
 *
 * ── The rubric is not derived, it is asserted ─────────────────────────────────
 * Every field comes from what the person actually selected. The server does not
 * infer "quotes were fine because there were none" or default a missing answer
 * to acceptable — an unanswered rubric item is a bad request, because a silently
 * defaulted `true` would be counted later as the summariser getting it right.
 *
 * `quotesVerbatim` is the one nullable answer, and only for the stated reason:
 * the summary carried no quotes to judge.
 */

type Params = { params: Promise<{ id: string }> };

/** 1–5. Rejected rather than clamped: a 9 means the client is wrong, not the user. */
const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_NOTES_CHARS = 4000;

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const {
    supported,
    complete,
    quotesVerbatim,
    descriptiveOnly,
    overallAccuracy,
    notes,
  } = payload as Record<string, unknown>;

  // Every boolean must be answered. See the note above on defaulting. Written
  // out one by one rather than looped so TypeScript narrows each name — a loop
  // validates identically but leaves them `unknown` at the insert.
  if (typeof supported !== "boolean") {
    return new Response("supported must be answered", { status: 400 });
  }
  if (typeof complete !== "boolean") {
    return new Response("complete must be answered", { status: 400 });
  }
  if (typeof descriptiveOnly !== "boolean") {
    return new Response("descriptiveOnly must be answered", { status: 400 });
  }

  // null is a real answer here — "this summary had no quotes".
  if (quotesVerbatim !== null && typeof quotesVerbatim !== "boolean") {
    return new Response("quotesVerbatim must be answered", { status: 400 });
  }

  if (
    typeof overallAccuracy !== "number" ||
    !Number.isInteger(overallAccuracy) ||
    overallAccuracy < MIN_RATING ||
    overallAccuracy > MAX_RATING
  ) {
    return new Response("overallAccuracy must be 1–5", { status: 400 });
  }

  // Ownership is re-checked here: `id` comes from the URL and is untrusted.
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(eq(journalEntries.id, id), eq(journalEntries.userId, session.userId))
    )
    .limit(1);

  if (!entry) return new Response("Not found", { status: 404 });
  if (entry.purgedAt) return new Response("Gone", { status: 410 });

  const [summaryRow] = await db
    .select()
    .from(journalEntrySummaries)
    .where(eq(journalEntrySummaries.journalEntryId, id))
    .limit(1);

  // Nothing to assess without a summary — the rubric is entirely about one.
  if (!summaryRow) {
    return new Response("This entry has no summary yet", { status: 409 });
  }

  /*
   * Snapshot what was judged, when capture is on.
   *
   * Re-summarising overwrites the live summary and entries can be edited, so an
   * assessment that only referenced them would come to describe text nobody
   * read. Capture is switchable because these are copies of journal content and
   * the owner may not want them accumulating.
   */
  const captureSnapshots = await getBooleanSetting(EVAL_SNAPSHOTS_ENABLED, true);

  let entrySnapshot: string | null = null;
  let summarySnapshot: string | null = null;

  if (captureSnapshots) {
    try {
      // aiOriginal, not summary. Where the writer has corrected the summary,
      // `summary` holds their words — snapshotting that would file the person's
      // own edit as the summariser's output. The read-back UI shows the same
      // version for the same reason.
      const resolved = authoritativeSummary(summaryRow);
      summarySnapshot = encrypt(JSON.stringify(resolved.aiOriginal));
      if (entry.encryptedBody) {
        entrySnapshot = encrypt(decrypt(entry.encryptedBody));
      }
    } catch (err) {
      // An unreadable snapshot must not lose the assessment — the rubric is the
      // part worth keeping, and it stands on its own.
      console.error(
        `Evaluation snapshot failed for entry ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await db.insert(summaryEvaluations).values({
    id: randomUUID(),
    userId: session.userId,
    journalEntryId: id,
    supported,
    complete,
    quotesVerbatim,
    descriptiveOnly,
    overallAccuracy,
    summariserVersion: summaryRow.generationVersion,
    entryUpdatedAt: entry.updatedAt,
    encryptedEntrySnapshot: entrySnapshot,
    encryptedSummarySnapshot: summarySnapshot,
    encryptedNotes:
      typeof notes === "string" && notes.trim()
        ? encrypt(notes.trim().slice(0, MAX_NOTES_CHARS))
        : null,
  });

  return Response.json({ recordedAt: new Date().toISOString() });
}
