import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries, checkIns, contentAccessLog } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

export default async function ReflectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: reflectionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [reflection] = await db
    .select()
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!reflection || reflection.userId !== authSession.userId) notFound();

  // Audit: log this deliberate content access
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    reflectionId,
    context: "reflection_detail_view",
  });

  const [checkIn] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.reflectionId, reflectionId))
    .limit(1);

  const reflectionEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.reflectionId, reflectionId))
    .orderBy(asc(entries.sequence));

  const decoded = reflectionEntries.map((e) => {
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
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <Link href="/reflections" className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
            Reflections
          </Link>
          <Link href="/memory" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Mirror
          </Link>
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <a href="/" className="px-3 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-50 transition-colors">
            New reflection
          </a>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto space-y-8">
        {/* ── Reflection metadata ── */}
        <section className="text-xs text-stone-400 space-y-1">
          <p>
            <span className="font-medium text-stone-500">ID:</span>{" "}
            <span className="font-mono">{reflection.id}</span>
          </p>
          <p>
            <span className="font-medium text-stone-500">Type:</span>{" "}
            {reflection.type}
          </p>
          <p>
            <span className="font-medium text-stone-500">Started:</span>{" "}
            {reflection.startedAt
              ? new Date(reflection.startedAt).toLocaleString()
              : "—"}
          </p>
          <p>
            <span className="font-medium text-stone-500">Ended:</span>{" "}
            {reflection.endedAt
              ? new Date(reflection.endedAt).toLocaleString()
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
                  <span className="font-medium">Since last time:</span>{" "}
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
