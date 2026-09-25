import { requireAdmin } from "@/lib/auth/admin";
import { reviewEveryone } from "@/lib/mirror/review";

/**
 * Produces a Mirror report for every account, on demand.
 *
 * ── Why this is a route and not a server action ───────────────────────────────
 * A server action inherits the platform's default function timeout, which is a
 * few seconds. One report is one Sonnet call over the whole of somebody's
 * writing, and several accounts run in sequence — so the action was being killed
 * mid-run every time. From the browser that looked like the page freezing and
 * then nothing happening, with no error and no report.
 *
 * A route can declare its own limit, and the caller can show progress while it
 * waits. Both of those are the fix.
 */

export const dynamic = "force-dynamic";

/**
 * Long enough for several accounts in sequence. One report is a single call over
 * the entire archive, so it is slow by nature rather than by accident.
 *
 * If this is ever hit, the answer is batching across presses rather than a
 * bigger number — the platform has a hard ceiling and silently killing the run
 * halfway is the outcome being avoided here.
 */
export const maxDuration = 300;

export async function POST() {
  // Gated here, independently. This route is reachable without ever loading the
  // page that links to it.
  await requireAdmin();

  const started = Date.now();
  const result = await reviewEveryone();

  console.log(
    JSON.stringify({
      event: "mirror_manual_run",
      ran: result.ran,
      failed: result.failed,
      ms: Date.now() - started,
    })
  );

  return Response.json({ ...result, ms: Date.now() - started });
}
