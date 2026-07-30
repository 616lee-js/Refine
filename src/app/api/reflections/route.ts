import { randomUUID } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";

/**
 * Journal entries.
 *
 * Route stays at /api/reflections because "Reflections" is the user-facing word;
 * the underlying table is `journal_entries`. Same split as Mirror/memory.
 *
 * POST creates a new empty draft and returns its id. There is no reflection
 * type and no check-in step any more — those belonged to the chat model. The
 * framework check-in workflow will be its own thing.
 */
export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reuse an existing empty draft rather than accumulating abandoned blanks.
  // Starting a new entry twice in a row otherwise leaves an orphan draft in the
  // list every time.
  const [existingDraft] = await db
    .select({ id: journalEntries.id, encryptedBody: journalEntries.encryptedBody })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, session.userId),
        isNull(journalEntries.completedAt),
        isNull(journalEntries.deletedAt)
      )
    )
    .orderBy(desc(journalEntries.createdAt))
    .limit(1);

  if (existingDraft && !existingDraft.encryptedBody) {
    return Response.json({ reflectionId: existingDraft.id, resumed: true });
  }

  const id = randomUUID();

  await db.insert(journalEntries).values({
    id,
    userId: session.userId,
    modality: "text",
  });

  return Response.json({ reflectionId: id, resumed: false });
}
