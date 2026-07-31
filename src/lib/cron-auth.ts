/**
 * Authorisation for cron-invoked endpoints. One implementation, every cron route.
 *
 * ── Fails closed ──────────────────────────────────────────────────────────────
 * The previous shape was:
 *
 *     const expected = process.env.CRON_SECRET;
 *     if (expected) { ...check bearer... }
 *
 * which does nothing at all when the variable is unset. A missing env var
 * silently opened three endpoints — unauthenticated data destruction on
 * /api/cron/purge-trash, unauthenticated Anthropic spend on
 * /api/cron/summarise, and an open database ping on /api/health. Same class of
 * miss as the admin route that shipped with no session check: the failure was
 * invisible because nothing errored.
 *
 * Absence of configuration is now a refusal, never a bypass.
 *
 * ── Why 503 and 401 are distinguishable ───────────────────────────────────────
 * An unconfigured endpoint answers 503; a configured one answers 401 to a bad
 * or missing token. That does disclose "CRON_SECRET is not set here" to an
 * anonymous caller — a deliberate trade. The caller gains nothing, since the
 * endpoint refuses either way, while the operator gains the only outside-in way
 * to confirm production is configured correctly. Identical responses would hide
 * the misconfiguration from the person who needs to fix it just as effectively
 * as from an attacker.
 *
 * ── Vercel does not invent this value ─────────────────────────────────────────
 * CRON_SECRET is NOT auto-generated. You set it as an environment variable, and
 * Vercel then sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 * If it is unset, Vercel sends no Authorization header at all — so with this
 * change, an unset secret means every cron 401s rather than running wide open.
 * That is the intended behaviour, but it means the variable must exist in the
 * environment BEFORE this deploys, or the keep-alive stops and the Supabase
 * project pauses after roughly a week of apparent success.
 */

/** Returns a Response to send, or null when the caller is authorised. */
export function requireCronSecret(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Loud in the logs as well as in the response — this is a misconfiguration,
    // not a request problem, and it needs to be visible to whoever deploys.
    console.error(
      JSON.stringify({
        event: "cron_secret_missing",
        message:
          "CRON_SECRET is not set. Cron endpoints refuse all requests until it is.",
      })
    );
    return new Response("Cron endpoints are not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
