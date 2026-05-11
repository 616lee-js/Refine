import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries, checkIns, contentAccessLog } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.userId !== authSession.userId) notFound();

  // Audit: log this deliberate content access
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    sessionId,
    context: "session_detail_view",
  });

  const [checkIn] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.sessionId, sessionId))
    .limit(1);

  const sessionEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.sessionId, sessionId))
    .orderBy(asc(entries.sequence));

  const decoded = sessionEntries.map((e) => {
    let content = "[decrypt error]";
    try {
      content = decrypt(e.encryptedContent);
    } catch {}
    return { ...e, content };
  });

  const moodRating =
    checkIn?.mood &&
    typeof checkIn.mood === "object" &&
    "rating" in (checkIn.mood as object)
      ? (checkIn.mood as { rating: number }).rating
      : null;

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center gap-4">
        <Link
          href="/sessions"
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Reflections
        </Link>
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine — Reflection
        </h1>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto space-y-8">
        {/* ── Session metadata ── */}
        <section className="text-xs text-stone-400 space-y-1">
          <p>
            <span className="font-medium text-stone-500">ID:</span>{" "}
            <span className="font-mono">{session.id}</span>
          </p>
          <p>
            <span className="font-medium text-stone-500">Type:</span>{" "}
            {session.type}
          </p>
          <p>
            <span className="font-medium text-stone-500">Started:</span>{" "}
            {session.startedAt
              ? new Date(session.startedAt).toLocaleString()
              : "—"}
          </p>
          <p>
            <span className="font-medium text-stone-500">Ended:</span>{" "}
            {session.endedAt
              ? new Date(session.endedAt).toLocaleString()
              : "Active"}
          </p>
        </section>

        {/* ── Check-in data ── */}
        {checkIn && (
          <section>
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
              Check-in
            </h2>
            <div className="text-xs text-stone-500 space-y-1 bg-stone-50 rounded-xl p-4">
              {moodRating !== null && (
                <p>
                  <span className="font-medium">Mood:</span> {moodRating}/5
                </p>
              )}
              {checkIn.presentText && (
                <p>
                  <span className="font-medium">What brought you here:</span>{" "}
                  {checkIn.presentText}
                </p>
              )}
              {checkIn.intentionText && (
                <p>
                  <span className="font-medium">Intention:</span>{" "}
                  {checkIn.intentionText}
                </p>
              )}
              {checkIn.tierAtStart !== null && (
                <p>
                  <span className="font-medium">Tier at start:</span>{" "}
                  {checkIn.tierAtStart}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Entries ── */}
        <section>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">
            Entries ({decoded.length})
          </h2>
          {decoded.length === 0 ? (
            <p className="text-sm text-stone-400">No entries.</p>
          ) : (
            <ol className="space-y-5">
              {decoded.map((e) => (
                <li key={e.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium ${
                        e.source === "claude"
                          ? "bg-blue-50 text-blue-500"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {e.source === "claude" ? "Claude" : "User"}
                    </span>
                    <span>#{e.sequence}</span>
                    {e.tierClassification !== null && (
                      <span>T{e.tierClassification}</span>
                    )}
                    <span>
                      {e.createdAt
                        ? new Date(e.createdAt).toLocaleTimeString()
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap bg-stone-50 rounded-lg px-4 py-3">
                    {e.content}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
