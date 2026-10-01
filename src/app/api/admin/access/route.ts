import { isAdminUserId } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth";
import {
  createInviteCodes,
  revokeInviteCode,
  MAX_INVITES_PER_REQUEST,
} from "@/lib/auth/invite-admin";
import {
  issueResetCode,
  listResetCodes,
  revokeResetCode,
  RESET_CODE_HOURS,
} from "@/lib/auth/recovery";

/** `YYYY-MM-DD`, UTC — the same shape the rest of the admin screens use. */
function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Invite codes and password reset codes, for the admin screen.
 *
 * ── Gated here, not by the page that calls it ─────────────────────────────────
 * This is independently reachable: anyone who knows the path can POST to it,
 * whether or not they can load `/admin/access`. A check on the page protects the
 * page. This is the pattern that was missed once already, on `/admin/safety-log`.
 *
 * 404 rather than 403, same as `requireAdmin()`: a 403 confirms the route exists.
 *
 * ── Why routes rather than server actions ─────────────────────────────────────
 * Consistency with `/api/admin/mirror/cadence`, and because a generated code has
 * to come back in the response to be shown once. A server action returning a
 * secret through a form submission is a worse shape for the same job.
 *
 * ── A generated code is returned once and never again ─────────────────────────
 * Reset codes are stored hashed, so the response here is the only time the
 * plaintext exists outside the admin's screen. Nothing logs it.
 */

export const dynamic = "force-dynamic";

/** Shared by every branch, including the failures. */
function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId || !isAdminUserId(session.userId)) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { action } = body as { action?: unknown };

  try {
    switch (action) {
      case "invite_create": {
        const { count, expiresDays, note } = body as {
          count?: unknown;
          expiresDays?: unknown;
          note?: unknown;
        };
        const n = typeof count === "number" ? count : 1;
        if (!Number.isInteger(n) || n < 1 || n > MAX_INVITES_PER_REQUEST) {
          return new Response(
            `Count must be between 1 and ${MAX_INVITES_PER_REQUEST}`,
            { status: 422 }
          );
        }
        // null means never expires, matching the CLI's default.
        const days =
          expiresDays === null || expiresDays === undefined
            ? null
            : typeof expiresDays === "number"
              ? expiresDays
              : NaN;
        if (days !== null && (!Number.isInteger(days) || days < 1)) {
          return new Response("Expiry must be a whole number of days", {
            status: 422,
          });
        }
        const codes = await createInviteCodes(n, {
          expiresDays: days,
          note: typeof note === "string" ? note : null,
        });
        return Response.json({ codes });
      }

      case "invite_revoke": {
        const { code } = body as { code?: unknown };
        if (typeof code !== "string" || !code.trim()) {
          return new Response("A code is required", { status: 422 });
        }
        const revoked = await revokeInviteCode(code);
        // False means it did not exist or was already used. Reported plainly —
        // this is the admin's own screen, so there is nothing to withhold.
        return Response.json({ revoked });
      }

      case "reset_create": {
        const { email, note } = body as { email?: unknown; note?: unknown };
        if (typeof email !== "string" || !email.trim()) {
          return new Response("An email address is required", { status: 422 });
        }
        const issued = await issueResetCode(
          email,
          typeof note === "string" ? note : null
        );
        if (!issued) {
          // No account with that address. Said plainly, again because the
          // audience is the admin — the public reset screen says nothing.
          return Response.json({ found: false });
        }
        return Response.json({
          found: true,
          code: issued.code,
          expiresAt: issued.expiresAt.toISOString(),
          hours: RESET_CODE_HOURS,
        });
      }

      case "reset_list": {
        const { email } = body as { email?: unknown };
        if (typeof email !== "string" || !email.trim()) {
          return new Response("An email address is required", { status: 422 });
        }
        const rows = await listResetCodes(email);
        if (rows === null) return Response.json({ found: false });
        /*
         * Dates are formatted here, not in the browser.
         *
         * The caller is a client component, and a date formatted there renders
         * one way on the server and another at hydration — the mismatch that
         * took the check-in page down. These never touch the server's HTML, but
         * formatting them in one place keeps the rule unbroken rather than
         * relying on this particular path being safe.
         */
        return Response.json({
          found: true,
          rows: rows.map((r) => ({
            id: r.id,
            note: r.note,
            usedAt: r.usedAt?.toISOString() ?? null,
            revokedAt: r.revokedAt?.toISOString() ?? null,
            expiresAt: r.expiresAt.toISOString(),
            createdLabel: day(r.createdAt),
            expiresLabel: day(r.expiresAt),
          })),
        });
      }

      case "reset_revoke": {
        const { id } = body as { id?: unknown };
        if (typeof id !== "string" || !id) {
          return new Response("An id is required", { status: 422 });
        }
        await revokeResetCode(id);
        return Response.json({ revoked: true });
      }

      default:
        return new Response("Unknown action", { status: 422 });
    }
  } catch (err) {
    // Never echo the error: these paths touch email addresses and generated
    // codes, and an error string is exactly where one leaks into a browser.
    console.error(
      "Admin access action failed:",
      err instanceof Error ? err.message : err
    );
    return new Response("That didn't work", { status: 500 });
  }
}
