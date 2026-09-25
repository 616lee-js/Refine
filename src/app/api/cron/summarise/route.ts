import { runSummaryQueue, SUMMARY_BATCH_SIZE } from "@/lib/summaries/queue";
import { runMirrorReviews } from "@/lib/mirror/review";
import { requireCronSecret } from "@/lib/cron-auth";

/**
 * Generates Cabinet 2 summaries for completed entries that do not have a current
 * one. Runs daily via Vercel Cron (see vercel.json).
 *
 * ── This is the backstop, not the main path ───────────────────────────────────
 * Since 2026-08-04 a summary is generated when the entry is marked done, from
 * the PATCH in src/app/api/reflections/[id]/route.ts. This run exists for what
 * that misses:
 *
 * - entries whose on-submit attempt failed (transient Anthropic error, or the
 *   function torn down before the write landed)
 * - completed entries edited by autosave, which goes through PUT and is
 *   deliberately not summarised per keystroke pause
 * - prompt-version reflow across the whole archive, which nothing else walks
 *
 * Daily is enough for all three, which is as well: Vercel's Hobby plan caps cron
 * FREQUENCY at once per day. Raising it is a one-line schedule edit if the
 * backlog ever justifies one — the queue is derived, so running it more often is
 * simply running it more often.
 *
 * ── Mirror's review rides along ───────────────────────────────────────────────
 * It wants a weekly or fortnightly cadence, not a daily one, and it does not
 * need a schedule of its own to get one: it checks how long it has been since
 * each person's last review and skips anyone not yet due. Riding the nightly run
 * keeps the cadence a value in the database rather than a line in vercel.json,
 * which is what makes weekly-vs-fortnightly changeable without a deploy.
 *
 * Summaries run FIRST and are awaited. The review reads summaries, so running it
 * against an archive with a day's worth missing would quietly review less than
 * everything.
 *
 * ── Batch bound ───────────────────────────────────────────────────────────────
 * SUMMARY_BATCH_SIZE entries per run at concurrency 3. Leftovers stay due and
 * are picked up next run. Sized to finish well inside maxDuration — the failure
 * to avoid is the function being killed mid-call, which would leave attempts
 * incremented for work that never actually ran.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Fails closed: an unset CRON_SECRET refuses rather than bypasses.
  // See src/lib/cron-auth.ts.
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const started = Date.now();
  const result = await runSummaryQueue(SUMMARY_BATCH_SIZE);

  // Entry ids only — never content, never anything the model returned.
  console.log(
    JSON.stringify({
      event: "summary_queue_run",
      ...result,
      ms: Date.now() - started,
    })
  );

  // Never fails the run. Summarising is the job this endpoint exists for, and a
  // broken review must not make it look as though summaries did not happen.
  let mirror: Awaited<ReturnType<typeof runMirrorReviews>> | null = null;
  try {
    mirror = await runMirrorReviews();
    console.log(JSON.stringify({ event: "mirror_review_run", ...mirror }));
  } catch (err) {
    console.error(
      "mirror review run failed:",
      err instanceof Error ? err.message : err
    );
  }

  return Response.json({ ...result, mirror });
}
