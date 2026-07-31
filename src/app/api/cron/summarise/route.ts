import { runSummaryQueue, SUMMARY_BATCH_SIZE } from "@/lib/summaries/queue";
import { requireCronSecret } from "@/lib/cron-auth";

/**
 * Generates Cabinet 2 summaries for completed entries that do not have a current
 * one. Runs daily via Vercel Cron (see vercel.json).
 *
 * ── Why daily is acceptable ───────────────────────────────────────────────────
 * Vercel's Hobby plan caps cron FREQUENCY at once per day. Nothing reads
 * summaries yet — Phase 6 memory extraction consumes them in bulk — so a summary
 * landing up to 24 hours after the entry costs nothing today. If it ever needs
 * to be minutes, that is a plan change and a one-line schedule edit, not a
 * redesign: the queue is derived, so running it more often is simply running it
 * more often.
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

  return Response.json(result);
}
