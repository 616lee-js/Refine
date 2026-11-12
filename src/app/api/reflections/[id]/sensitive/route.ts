import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";

/**
 * Marks an entry sensitive, or unmarks it. `{ sensitive: boolean }`.
 *
 * ── What the flag does ────────────────────────────────────────────────────────
 * The entry stays theirs to read, edit, title and keep, and it is still
 * classified for safety. It is left out of everything that reads entries to
 * say something about the person: Mirror reports, Threads, Trends, and the
 * personal footholds. Owner's decision, 2026-11-11. Each of those surfaces
 * applies the exclusion itself where it reads; this route only sets the time.
 *
 * A time rather than a yes/no, so the report run can tell whether an entry was
 * flagged after a report had already read it — see reviewUser().
 */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { sensitive } = body as { sensitive?: unknown };
  if (typeof sensitive !== "boolean") {
    return new Response("sensitive must be true or false", { status: 400 });
  }

  const [entry] = await db
    .select({
      id: journalEntries.id,
      purgedAt: journalEntries.purgedAt,
      sensitiveAt: journalEntries.sensitiveAt,
    })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, session.userId)))
    .limit(1);
  if (!entry) return new Response("Not found", { status: 404 });
  if (entry.purgedAt) return new Response("Gone", { status: 410 });

  // Already in the asked-for state: nothing to write, and in particular the
  // flag time is not moved — it records when the entry was first flagged.
  if (sensitive === (entry.sensitiveAt !== null)) {
    return Response.json({ sensitive });
  }

  await db
    .update(journalEntries)
    .set({ sensitiveAt: sensitive ? new Date() : null })
    .where(eq(journalEntries.id, id));

  return Response.json({ sensitive });
}
