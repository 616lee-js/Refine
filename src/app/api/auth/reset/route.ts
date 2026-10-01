import { NextRequest, NextResponse } from "next/server";
import { redeemResetCode, ResetError } from "@/lib/auth/recovery";
import { requestOrigin } from "@/lib/request-origin";

/**
 * Redeeming a password reset code.
 *
 * ── Public, and has to be ────────────────────────────────────────────────────
 * Reachable without a session by definition — the whole point is that the person
 * cannot sign in. Listed in `src/middleware.ts` PUBLIC_PATHS alongside login and
 * signup; without that the middleware redirects it to /login and the form posts
 * into nothing.
 *
 * ── Nothing is logged about the attempt ───────────────────────────────────────
 * No email, no code, no reason, not even on failure. The throttle counts failures
 * against a hash of the address and that is the entire record. A log line naming
 * an address that tried to reset is a list of people who lost access to a mental
 * health journal.
 *
 * ── A form POST, like login and signup ───────────────────────────────────────
 * Redirects with 303 and an `error` parameter rather than returning JSON, so the
 * page works with no JavaScript and the back button does not re-submit.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = form.get("email");
  const code = form.get("code");
  const password = form.get("password");

  const origin = requestOrigin(req);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/reset?error=${reason}`, origin), 303);

  if (
    typeof email !== "string" ||
    typeof code !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !code.trim() ||
    !password
  ) {
    return fail("missing");
  }

  try {
    await redeemResetCode(email, code, password);
  } catch (err) {
    if (err instanceof ResetError) {
      switch (err.reason) {
        case "WEAK_PASSWORD":
          return fail("weak");
        case "LOCKED":
          return fail("locked");
        default:
          return fail("invalid");
      }
    }
    // Something genuinely unexpected. Reported as the generic failure rather
    // than a 500, because the person's next move is the same either way: ask for
    // another code. The error is still thrown to the platform's logs by rethrowing
    // nothing — deliberately not swallowed silently here, see below.
    console.error(
      "Password reset failed unexpectedly:",
      err instanceof Error ? err.message : err
    );
    return fail("invalid");
  }

  /*
   * No session is created. Setting a password and signing in are separate: a code
   * holder who is not the account owner would otherwise be inside the account the
   * instant they guessed, and the owner would have no way to notice. They sign in
   * with the new password like anyone else.
   */
  return NextResponse.redirect(new URL("/reset?done=1", origin), 303);
}
