import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, users } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import JournalEntry from "../../journal-entry";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * The writing surface for one journal entry — new, draft, or editing a
 * completed one. Read-only viewing lives at /reflections/[id].
 */
export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, authSession.userId)
      )
    )
    .limit(1);

  if (!entry) notFound();

  // Purged entries have no content and must not be reopened for writing — that
  // would resurrect a row the user deliberately destroyed. Trashed entries are
  // restorable, but restoring is an explicit action from the trash view.
  if (entry.purgedAt || entry.deletedAt) notFound();

  let initialText = "";
  if (entry.encryptedBody) {
    try {
      initialText = decrypt(entry.encryptedBody);
    } catch (err) {
      // Fail closed rather than opening an editor showing an empty body over
      // content that exists — saving would overwrite unreadable-but-present
      // writing with blanks.
      console.error(
        `Journal entry decrypt failed for ${id}; refusing to open the editor:`,
        err instanceof Error ? err.message : err
      );
      throw new Error("This entry could not be read and was not opened for editing.");
    }
  }

  // Guidance is expanded by default: guidance nobody can find does not exist.
  // The stored preference only overrides that once the user has chosen.
  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .limit(1);

  const prefs =
    user?.preferences && typeof user.preferences === "object"
      ? (user.preferences as Record<string, unknown>)
      : {};

  const initialGuidanceOpen =
    typeof prefs.guidanceOpen === "boolean" ? prefs.guidanceOpen : true;

  return (
    <JournalEntry
      admin={<AdminNav />}
      entryId={entry.id}
      initialText={initialText}
      initialCompletedAt={entry.completedAt?.toISOString() ?? null}
      initialGuidanceOpen={initialGuidanceOpen}
    />
  );
}
