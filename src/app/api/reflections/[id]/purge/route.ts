import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, journalEntrySummaries } from "@/lib/db/schema";

/**
 * Permanently destroy an entry's content.
 *
 * ── Why the row survives ──────────────────────────────────────────────────────
 * `safety_log` references this entry. Deleting the row would fire
 * ON DELETE SET NULL and detach the safety record from what produced it, and
 * deleting with a cascade would destroy the record outright. The safety log is a
 * log: it has to outlive the content it describes.
 *
 * So purge nulls the body and stamps `purged_at`. The user's words are genuinely
 * gone — this is not archival, there is no recovery, and "deletion means genuine
 * deletion" is honoured. What remains is a shell holding no content: an id, a
 * timestamp, and the tier that was detected.
 *
 * Cabinet 2 summaries derive from the body, so they are hard-deleted here. A
 * summary of destroyed content is still that content.
 *
 * Every list query must exclude rows with `purged_at` set — they are bookkeeping,
 * not entries.
 */
export async function DELETE(
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
  if (entry.purgedAt) return new Response(null, { status: 204 }); // already purged

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(journalEntrySummaries)
      .where(eq(journalEntrySummaries.journalEntryId, id));

    await tx
      .update(journalEntries)
      .set({
        encryptedBody: null,
        purgedAt: now,
        // Keep deletedAt set so the entry stays out of the active list even if
        // purgedAt filtering is ever missed somewhere.
        deletedAt: now,
        extractionStatus: null,
        updatedAt: now,
      })
      .where(eq(journalEntries.id, id));
  });

  return new Response(null, { status: 204 });
}
