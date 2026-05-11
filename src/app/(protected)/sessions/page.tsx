import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries } from "@/lib/db/schema";

const TYPE_LABELS: Record<string, string> = {
  as_needed: "As-needed",
  scheduled: "Scheduled",
  guided: "Guided",
};

export default async function SessionsPage() {
  const authSession = await getSession();
  const rows = await db
    .selectDistinct({
      id: sessions.id,
      type: sessions.type,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
    })
    .from(sessions)
    .innerJoin(
      entries,
      and(eq(entries.sessionId, sessions.id), ne(entries.source, "claude"))
    )
    .where(eq(sessions.userId, authSession.userId!))
    .orderBy(desc(sessions.startedAt));

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine — Reflections
        </h1>
        <Link
          href="/"
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← New reflection
        </Link>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-400">No reflections yet.</p>
        ) : (
          <ol className="divide-y divide-stone-100">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between py-3 hover:bg-stone-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-stone-700">
                      {s.startedAt
                        ? new Date(s.startedAt).toLocaleString()
                        : "—"}
                    </p>
                    <p className="text-xs text-stone-400">
                      {TYPE_LABELS[s.type] ?? s.type}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      s.endedAt
                        ? "bg-stone-100 text-stone-400"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {s.endedAt ? "Ended" : "Active"}
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
