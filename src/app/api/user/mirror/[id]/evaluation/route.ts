import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mirrorReviews, reportEvaluations } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { EVAL_SNAPSHOTS_ENABLED, getBooleanSetting } from "@/lib/settings";

/**
 * Recording an assessment of one Mirror report.
 *
 * ── This changes nothing for the person submitting it ─────────────────────────
 * Their future reports are unaffected. It is evidence about the instructions in
 * src/lib/layer2/memory-extraction.md, reviewed by the product owner and acted
 * on by hand. Nothing here feeds back into generation.
 *
 * ── The rubric is asserted, never inferred ────────────────────────────────────
 * Every answer comes from what the person actually selected. The server does not
 * decide that a report "hedged correctly because it mentioned no condition" — a
 * defaulted `true` on that question would inflate the pass rate on the riskiest
 * rule in the app, which is the opposite of what this log exists for.
 *
 * Two answers are nullable, and only for their stated reasons: the report
 * mentioned no condition, or carried no figures.
 */

/** 1–5. Rejected rather than clamped: a 9 means the client is wrong. */
const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_NOTES_CHARS = 4000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    descriptiveOnly,
    noPrediction,
    hedgingRight,
    figuresUntouched,
    overallAccuracy,
    notes,
  } = payload as Record<string, unknown>;

  // Written out one by one rather than looped, so TypeScript narrows each name.
  if (typeof supported !== "boolean") {
    return new Response("supported must be answered", { status: 400 });
  }
  if (typeof complete !== "boolean") {
    return new Response("complete must be answered", { status: 400 });
  }
  if (typeof descriptiveOnly !== "boolean") {
    return new Response("descriptiveOnly must be answered", { status: 400 });
  }
  if (typeof noPrediction !== "boolean") {
    return new Response("noPrediction must be answered", { status: 400 });
  }

  // null is a real answer on these two. See the note above.
  if (hedgingRight !== null && typeof hedgingRight !== "boolean") {
    return new Response("hedgingRight must be answered", { status: 400 });
  }
  if (figuresUntouched !== null && typeof figuresUntouched !== "boolean") {
    return new Response("figuresUntouched must be answered", { status: 400 });
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
  const [report] = await db
    .select()
    .from(mirrorReviews)
    .where(and(eq(mirrorReviews.id, id), eq(mirrorReviews.userId, session.userId)))
    .limit(1);

  if (!report) return new Response("Not found", { status: 404 });

  /*
   * Snapshot what was judged, when capture is on.
   *
   * `encryptedReport`, never `encryptedUserReport`: where the person has
   * rewritten the report, judging their rewrite would measure them rather than
   * the instructions. The panel shows them the generated version for the same
   * reason.
   *
   * It matters more here than for summaries. A summary can be regenerated from
   * the entry; a report can be deleted from Mirror outright, and then there is
   * nothing left to re-read. With capture off, an assessment of a deleted
   * report is a rating with no subject.
   */
  const captureSnapshots = await getBooleanSetting(EVAL_SNAPSHOTS_ENABLED, true);

  let reportSnapshot: string | null = null;
  if (captureSnapshots) {
    try {
      reportSnapshot = encrypt(decrypt(report.encryptedReport));
    } catch (err) {
      // An unreadable snapshot must not lose the assessment — the rubric is the
      // part worth keeping and it stands on its own.
      console.error(
        `Report snapshot failed for review ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await db.insert(reportEvaluations).values({
    id: randomUUID(),
    userId: session.userId,
    mirrorReviewId: id,
    supported,
    complete,
    descriptiveOnly,
    noPrediction,
    hedgingRight,
    figuresUntouched,
    overallAccuracy,
    promptVersion: report.modelVersion,
    encryptedReportSnapshot: reportSnapshot,
    encryptedNotes:
      typeof notes === "string" && notes.trim()
        ? encrypt(notes.trim().slice(0, MAX_NOTES_CHARS))
        : null,
  });

  return Response.json({ recordedAt: new Date().toISOString() });
}
