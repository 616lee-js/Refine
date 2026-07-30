import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { TrashList, type TrashedEntry } from "./trash-list";
import { TRASH_RETENTION_DAYS } from "@/lib/journal/retention";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  // Trashed but not yet purged. A purged row is a shell with no content — it
  // exists only so safety_log keeps its reference, and must never be listed.
  const rows = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, authSession.userId),
        isNotNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    )
    .orderBy(desc(journalEntries.deletedAt));

  const now = Date.now();

  const entries: TrashedEntry[] = rows.map((r) => {
    let preview = "";
    if (r.encryptedBody) {
      try {
        // Preview only — enough to recognise which entry this is without
        // rendering the whole thing on a page about deleting it.
        preview = decrypt(r.encryptedBody).slice(0, 180);
      } catch {
        preview = "[could not be read]";
      }
    }

    const deletedAt = r.deletedAt!;
    const elapsedDays = Math.floor((now - deletedAt.getTime()) / 86_400_000);

    return {
      id: r.id,
      deletedAt: deletedAt.toISOString(),
      writtenAt: (r.completedAt ?? r.createdAt).toISOString(),
      preview,
      daysLeft: Math.max(0, TRASH_RETENTION_DAYS - elapsedDays),
    };
  });

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <Link href="/reflections" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Reflections
          </Link>
          <Link href="/mirror" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Mirror
          </Link>
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <Link href="/" className="px-3 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-50 transition-colors">
            New reflection
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-sm font-medium text-stone-700">Trash</h2>
          <Link
            href="/mirror"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            ← Back to Mirror
          </Link>
        </div>

        <TrashList entries={entries} />
      </main>
    </div>
  );
}
