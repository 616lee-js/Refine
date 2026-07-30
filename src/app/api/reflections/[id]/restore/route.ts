import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";

/** Bring an entry back out of the trash. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  const [entry] = await db
    .select({ id: journalEntries.id, purgedAt: journalEntries.purgedAt })
    .from(journalEntries)
    .where(
      and(eq(journalEntries.id, id), eq(journalEntries.userId, session.userId))
    )
    .limit(1);

  if (!entry) return new Response("Not found", { status: 404 });

  // Purged content is genuinely gone; there is nothing to restore. Saying so is
  // better than restoring an empty entry and letting the user think it worked.
  if (entry.purgedAt) {
    return new Response("Content was permanently deleted and cannot be restored", {
      status: 410,
    });
  }

  await db
    .update(journalEntries)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(journalEntries.id, id));

  return new Response(null, { status: 204 });
}
