import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mirrorReviews } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";

/**
 * Editing a Mirror report.
 *
 * ── Their version wins ────────────────────────────────────────────────────────
 * A report is Refine's account of a person. When they rewrite it, the rewrite is
 * what Mirror shows and what the next run builds on — see
 * `authoritativeReport()` in src/lib/mirror/read.ts, which is the only place
 * that rule lives.
 *
 * The generated version is never overwritten. It stays in `encrypted_report` so
 * an edit can be compared against what prompted it, and reverted.
 *
 * ── Reverting ─────────────────────────────────────────────────────────────────
 * Sending empty content clears the edit rather than storing an empty report.
 * "Put it back how it was" is a thing people want, and an empty report would
 * otherwise be indistinguishable from a blank one Refine had written.
 */

/** A report someone has rewritten by hand is not a place to paste a novel. */
const MAX_REPORT_CHARS = 20_000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { content } = body as { content?: unknown };
  if (typeof content !== "string") {
    return new Response("content required", { status: 400 });
  }
  if (content.length > MAX_REPORT_CHARS) {
    return new Response("Too long", { status: 413 });
  }

  // Ownership re-checked: `id` comes from the URL and is untrusted.
  const [row] = await db
    .select({ id: mirrorReviews.id })
    .from(mirrorReviews)
    .where(and(eq(mirrorReviews.id, id), eq(mirrorReviews.userId, session.userId)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const trimmed = content.trim();

  await db
    .update(mirrorReviews)
    .set(
      trimmed
        ? { encryptedUserReport: encrypt(trimmed), userEditedAt: new Date() }
        : // Revert: back to what Refine wrote, with no trace of an edit.
          { encryptedUserReport: null, userEditedAt: null }
    )
    .where(eq(mirrorReviews.id, id));

  return Response.json({ savedAt: new Date().toISOString(), edited: Boolean(trimmed) });
}
