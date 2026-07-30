import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries, journalEntrySummaries } from "@/lib/db/schema";
import { TRASH_RETENTION_DAYS } from "@/lib/journal/retention";

/**
 * Destroys the content of entries that have been in the trash past the
 * retention window. Runs daily via Vercel Cron (see vercel.json).
 *
 * ── What it does and does not delete ──────────────────────────────────────────
 * Nulls `encrypted_body`, stamps `purged_at`, and hard-deletes any Cabinet 2
 * summary (a summary of destroyed content is still that content).
 *
 * The `journal_entries` row itself SURVIVES, empty. `safety_log` references it,
 * and the safety log has to outlive the content it describes — it is the record
 * of what was detected, holds no journal text, and is the product owner's only
 * means of reviewing classifier accuracy. Deleting the row would either detach
 * that record or destroy it.
 *
 * This is still genuine deletion: the user's words are gone and unrecoverable.
 * What remains is an id, some timestamps, and a tier.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel sends this automatically on cron invocations when CRON_SECRET is set.
  // Without the check this is an endpoint that destroys data on request.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);

  const due = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        isNotNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt),
        lt(journalEntries.deletedAt, cutoff)
      )
    );

  let purged = 0;
  const now = new Date();

  for (const { id } of due) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(journalEntrySummaries)
          .where(eq(journalEntrySummaries.journalEntryId, id));

        await tx
          .update(journalEntries)
          .set({
            encryptedBody: null,
            purgedAt: now,
            extractionStatus: null,
            updatedAt: now,
          })
          .where(eq(journalEntries.id, id));
      });
      purged++;
    } catch (err) {
      // One bad row must not stop the rest — otherwise a single failure leaves
      // everything behind it in the trash indefinitely. Logged without content.
      console.error(`purge-trash: failed for entry ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    JSON.stringify({
      event: "purge_trash",
      due: due.length,
      purged,
      retentionDays: TRASH_RETENTION_DAYS,
    })
  );

  return Response.json({ due: due.length, purged });
}
