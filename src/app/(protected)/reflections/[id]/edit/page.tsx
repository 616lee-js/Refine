import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { guidanceFor } from "@/lib/journal/personal-guidance";
import { categoriesForEntries, listCategories } from "@/lib/journal/categories";
import { fmtDateWeekday } from "@/lib/time";
import { timeZoneFor } from "@/lib/time-zone";
import JournalEntry from "../../../journal-entry";

/**
 * Editing an entry, in the archive's main view.
 *
 * The writing surface was the last screen that still navigated away from the
 * record list. It now opens here instead, beside the list, and returns to the
 * read view at `/reflections/[id]` on save or cancel.
 *
 * ── Footholds move out of the layout ──────────────────────────────────────────
 * They would otherwise put a rail on both sides of the text — record list left,
 * guidance right — which squeezes the writing to about 274px at the `lg`
 * breakpoint. Embedded, the footholds become the edge tab and its overlay at
 * every width, so the text keeps the full column. See `overlayOnly` in
 * components/ui/journal-guidance-sidebar.tsx.
 *
 * ── A brand-new entry still gets its own screen ───────────────────────────────
 * `/reflection/[id]` stays for that: a blank page has nothing to browse beside
 * it, and Home's "Begin" goes there. Only editing something that already exists
 * happens here.
 */

// COPY REVIEW: this message reaches the user through the error boundary.
const COPY = {
  unreadable:
    "[COPY] This entry could not be read and was not opened for editing.",
} as const;

export default async function EditEntryPage({
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
      throw new Error(COPY.unreadable);
    }
  }

  // Footholds start closed on every entry. Product owner, 2026-10-09, restated
  // 2026-11-11: no saved preference reopens them. See journal-entry.tsx.

  // Same footholds as a new entry, including the personal ones.
  const guidance = await guidanceFor(authSession.userId);
  const tz = await timeZoneFor(authSession.userId);
  const [tagsByEntry, userCategories] = await Promise.all([
    categoriesForEntries(authSession.userId, [entry.id]),
    listCategories(authSession.userId),
  ]);

  return (
    <JournalEntry
      embedded
      entryId={entry.id}
      initialText={initialText}
      initialCompletedAt={entry.completedAt?.toISOString() ?? null}
      dateLabel={fmtDateWeekday(entry.completedAt ?? entry.createdAt, tz)}
      tags={tagsByEntry.get(entry.id) ?? []}
      userCategories={userCategories.map(({ id, name }) => ({ id, name }))}
      guidance={guidance}
    />
  );
}
