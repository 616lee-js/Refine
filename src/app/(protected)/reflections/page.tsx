import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries } from "@/lib/db/schema";

const TYPE_LABELS: Record<string, string> = {
  as_needed: "As-needed",
  scheduled: "Scheduled",
  guided: "Guided",
};

export default async function ReflectionsPage() {
  const authSession = await getSession();
  const rows = await db
    .selectDistinct({
      id: reflections.id,
      type: reflections.type,
      startedAt: reflections.startedAt,
      endedAt: reflections.endedAt,
    })
    .from(reflections)
    .innerJoin(
      entries,
      and(eq(entries.reflectionId, reflections.id), ne(entries.source, "claude"))
    )
    .where(eq(reflections.userId, authSession.userId!))
    .orderBy(desc(reflections.startedAt));

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <span className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
            Reflections
          </span>
          <Link href="/memory" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
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
                  href={`/reflections/${r.id}`}
                  className="flex items-center justify-between py-3 hover:bg-stone-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-stone-700">
                      {r.startedAt
                        ? new Date(r.startedAt).toLocaleString()
                        : "—"}
                    </p>
                    <p className="text-xs text-stone-400">
                      {TYPE_LABELS[r.type] ?? r.type}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      r.endedAt
                        ? "bg-stone-100 text-stone-400"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {r.endedAt ? "Ended" : "Active"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
