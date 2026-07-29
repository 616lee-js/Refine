import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Admin authorization.
 *
 * The ONLY path to admin is being listed in the ADMIN_USER_IDS environment
 * variable. Deliberately absent, and deliberately never to be added:
 *   - no isAdmin / role column on users
 *   - no first-user-is-admin rule
 *   - no default or fallback value
 *   - no application code path that grants admin to anyone
 *
 * Fail closed: unset, empty, or whitespace-only means NOBODY is an admin.
 *
 * Read per call rather than cached at module scope, so a warm serverless
 * instance cannot serve a stale allowlist. Note that Vercel bakes environment
 * variables into a deployment, so changing the value in the dashboard requires a
 * redeploy before it takes effect.
 */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminUserId(userId: string): boolean {
  const allowed = adminUserIds();
  return allowed.length > 0 && allowed.includes(userId);
}

/**
 * Requires a valid session belonging to an admin. Responds 404 otherwise.
 *
 * 404 rather than 403 on purpose: a 403 confirms the route exists, and this
 * route guards PHI. A redirect would be worse still — it both confirms the
 * route and bounces the user into something that looks like a normal login
 * flow. To a non-admin, /admin/* is indistinguishable from a typo.
 *
 * notFound() is also deliberately chosen over Next's forbidden(), which would
 * require the experimental `authInterrupts` flag. No experimental API belongs
 * in the production path guarding journal content.
 *
 * Call this in every admin page AND in every admin server action. Server actions
 * are independently addressable endpoints; a check on the page that renders them
 * does not protect them.
 */
export async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session.userId) notFound();
  if (!isAdminUserId(session.userId)) notFound();
  return session.userId;
}
