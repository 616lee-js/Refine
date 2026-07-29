import { after } from "next/server";

/**
 * Keeps a serverless function alive for a database write that happens after the
 * response stream has closed.
 *
 * ── The bug this exists to prevent ────────────────────────────────────────────
 * The streaming routes save the assistant's message once the model has finished
 * producing it — which is after `controller.close()`. Written as an un-awaited
 * promise, that work races the platform: on Vercel the function can be frozen or
 * torn down as soon as the response finishes, so the insert sometimes lands and
 * sometimes doesn't. Intermittent silent data loss is worse than a hard failure,
 * and it is exactly the kind of thing solo testing does not reliably surface.
 *
 * `after()` is Next's supported escape hatch: it maps to the platform's
 * `waitUntil` on Vercel and keeps working when self-hosted. It must be called
 * while the request context is still active, so `persistAfterResponse()` is
 * called from the route handler body — never from inside a stream callback.
 *
 * ── Why the promise always settles ────────────────────────────────────────────
 * `after()` holds the function open until the promise settles. A path that
 * neither runs nor aborts would keep it open until the platform timeout, burning
 * the full `maxDuration` on every request. Both terminal stream events therefore
 * settle it, and `run()` settles in a `finally` so a failed write releases the
 * function rather than hanging it.
 */
export function persistAfterResponse(label: string) {
  let settle!: () => void;
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  after(done);

  let finished = false;

  return {
    /**
     * Perform the post-response write. Errors are logged, never thrown — the
     * response has already been sent, so there is nobody left to report to.
     */
    run(work: () => Promise<unknown>) {
      if (finished) return;
      finished = true;
      work()
        .catch((err) => console.error(`${label} failed:`, err))
        .finally(() => settle());
    },

    /** Nothing to persist — release the function immediately. */
    abort() {
      if (finished) return;
      finished = true;
      settle();
    },
  };
}
