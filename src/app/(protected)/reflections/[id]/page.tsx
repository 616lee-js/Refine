import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, contentAccessLog } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * Read view for a completed journal entry.
 *
 * Deliberately not editable here — editing happens on the writing surface at
 * /reflection/[id]. This page is for re-reading what you wrote.
 */
export default async function ReflectionDetailPage({
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

  // Ownership is enforced in the query, so a miss is either "not yours" or
  // "doesn't exist" — both 404, which avoids confirming that an id exists.
  if (!entry) notFound();

  // A purged entry has no content to show. Its row only exists so the safety
  // log keeps its reference.
  if (entry.purgedAt) notFound();

  // Audit: this is a deliberate decryption event.
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    journalEntryId: id,
    context: "journal_entry_detail_view",
  });

  let body = "";
  let decryptFailed = false;
  if (entry.encryptedBody) {
    try {
      body = decrypt(entry.encryptedBody);
    } catch (err) {
      decryptFailed = true;
      console.error(
        `Journal entry decrypt failed for ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const written = entry.completedAt ?? entry.createdAt;

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <Link href="/reflections" className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
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
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-medium text-stone-700">
              {new Date(written).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <p className="mt-0.5 text-xs text-stone-400">
              {new Date(written).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
              {!entry.completedAt && " · draft"}
            </p>
          </div>
          <Link
            href={`/reflection/${entry.id}`}
            className="shrink-0 text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            Edit
          </Link>
        </div>

        {decryptFailed ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-5 py-4">
            This entry could not be read. Its content is still stored, but the
            encryption key does not match — nothing has been lost, and it should
            not be edited or overwritten until that is resolved.
          </p>
        ) : body ? (
          <article className="text-[15px] text-stone-700 leading-relaxed whitespace-pre-wrap">
            {body}
          </article>
        ) : (
          <p className="text-sm text-stone-400">This entry is empty.</p>
        )}
      </main>
    </div>
  );
}
