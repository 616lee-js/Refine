import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safetyLog, entries } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

async function markReviewed(formData: FormData) {
  "use server";
  const logId = formData.get("logId") as string;
  if (!logId) return;
  await db
    .update(safetyLog)
    .set({ reviewed: true })
    .where(eq(safetyLog.id, logId));
  revalidatePath("/admin/safety-log");
}

const TIER_COLORS: Record<number, string> = {
  0: "bg-stone-100 text-stone-500",
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-red-100 text-red-700",
};

export default async function SafetyLogPage() {
  const rows = await db
    .select({
      id: safetyLog.id,
      reflectionId: safetyLog.reflectionId,
      tier: safetyLog.tier,
      classifierVersion: safetyLog.classifierVersion,
      createdAt: safetyLog.createdAt,
      reviewed: safetyLog.reviewed,
      reviewerNotes: safetyLog.reviewerNotes,
      entryId: safetyLog.entryId,
      encryptedContent: entries.encryptedContent,
    })
    .from(safetyLog)
    .leftJoin(entries, eq(safetyLog.entryId, entries.id))
    .orderBy(desc(safetyLog.createdAt));

  const decoded = rows.map((row) => {
    let content: string | null = null;
    if (row.encryptedContent) {
      try {
        content = decrypt(row.encryptedContent);
      } catch {
        content = "[decrypt error]";
      }
    }
    return { ...row, content };
  });

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine — Safety Log
        </h1>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto">
        {decoded.length === 0 ? (
          <p className="text-sm text-stone-400">No safety log entries yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-stone-400 border-b border-stone-100">
                <th className="pb-2 pr-4 font-medium">Tier</th>
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium">Reflection</th>
                <th className="pb-2 pr-4 font-medium">Classifier</th>
                <th className="pb-2 pr-4 font-medium">Chars</th>
                <th className="pb-2 pr-4 font-medium">Reviewed</th>
                <th className="pb-2 font-medium">Content / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {decoded.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        TIER_COLORS[row.tier] ?? "bg-stone-100 text-stone-500"
                      }`}
                    >
                      T{row.tier}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-stone-500 whitespace-nowrap text-xs">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-stone-400">
                    {row.reflectionId.slice(0, 8)}…
                  </td>
                  <td className="py-3 pr-4 text-xs text-stone-400">
                    {row.classifierVersion}
                  </td>
                  <td className="py-3 pr-4 text-xs text-stone-500">
                    {row.content !== null ? row.content.length : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {row.reviewed ? (
                      <span className="text-xs text-green-600 font-medium">
                        ✓
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-3 space-y-2">
                    {row.content !== null && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-stone-400 hover:text-stone-600 list-none">
                          View content ↓
                        </summary>
                        <p className="mt-2 text-xs text-stone-600 leading-relaxed whitespace-pre-wrap max-w-prose bg-stone-50 rounded-lg p-3">
                          {row.content}
                        </p>
                      </details>
                    )}
                    {!row.reviewed && (
                      <form action={markReviewed}>
                        <input type="hidden" name="logId" value={row.id} />
                        <button
                          type="submit"
                          className="text-xs text-stone-400 hover:text-stone-700 underline transition-colors"
                        >
                          Mark reviewed
                        </button>
                      </form>
                    )}
                    {row.reviewerNotes && (
                      <p className="text-xs text-stone-400 italic">
                        {row.reviewerNotes}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
