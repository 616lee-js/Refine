import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";

export default async function ReflectionsPage() {
  const authSession = await getSession();
  // Trashed and purged entries are excluded. `deleted_at` covers both, since
  // purge leaves it set — but purgedAt is checked explicitly so the intent
  // survives any future change to that.
  const rows = await db
    .select({
      id: journalEntries.id,
      createdAt: journalEntries.createdAt,
      updatedAt: journalEntries.updatedAt,
      completedAt: journalEntries.completedAt,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, authSession.userId!),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    )
    .orderBy(desc(journalEntries.updatedAt));

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <span className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
            Reflections
          </span>
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
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            New reflection
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-stone-400">No reflections yet.</p>
        ) : (
          <ol className="divide-y divide-stone-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.completedAt ? `/reflections/${r.id}` : `/reflection/${r.id}`}
                  className="flex items-center justify-between py-3 hover:bg-stone-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-stone-700">
                      {new Date(r.completedAt ?? r.createdAt).toLocaleDateString(
                        undefined,
                        { weekday: "long", month: "long", day: "numeric" }
                      )}
                    </p>
                    <p className="text-xs text-stone-400">
                      {new Date(r.completedAt ?? r.updatedAt).toLocaleTimeString(
                        undefined,
                        { hour: "numeric", minute: "2-digit" }
                      )}
                    </p>
                  </div>
                  {!r.completedAt && (
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-700">
                      Draft
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
