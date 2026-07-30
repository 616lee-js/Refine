import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safetyLog, journalEntries } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/auth/admin";

// This page reads and decrypts safety-log content across ALL users. It must never
// be statically prerendered: a prerendered copy would bake decrypted PHI into an
// HTML file served from the CDN, and the authorization check below would run once
// at build time instead of once per visitor.
//
// requireAdmin() calls getSession() -> cookies(), which already forces dynamic
// rendering — this is here so that protection does not silently depend on that
// side effect.
export const dynamic = "force-dynamic";

async function markReviewed(formData: FormData) {
  "use server";
  // Server actions are independently addressable endpoints. Re-check authorization
  // here; the page-level check does not protect this.
  await requireAdmin();

  const logId = formData.get("logId") as string;
  if (!logId) return;
  await db
    .update(safetyLog)
    .set({ reviewed: true })
    .where(eq(safetyLog.id, logId));
  revalidatePath("/admin/safety-log");
}

/**
 * A questionnaire-sourced row means a *scored safety item* fired — PHQ-9 item 9
 * asks about self-harm — not something the user wrote in their own words. It
 * warrants a different response path, so it is styled to be unmistakable at a
 * glance rather than blending in with journal rows.
 */
const SOURCE_LABELS: Record<string, string> = {
  journal_entry: "Entry",
  journal_edit: "Entry (edit)",
  questionnaire: "Questionnaire",
};

const SOURCE_STYLES: Record<string, string> = {
  journal_entry: "bg-stone-100 text-stone-600",
  journal_edit: "bg-stone-100 text-stone-500",
  questionnaire: "bg-blue-100 text-blue-700",
};

const TIER_COLORS: Record<number, string> = {
  0: "bg-stone-100 text-stone-500",
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-red-100 text-red-700",
};

export default async function SafetyLogPage() {
  // Gate BEFORE any query runs. This page decrypts other users' journal content.
  await requireAdmin();

  const rows = await db
    .select({
      id: safetyLog.id,
      source: safetyLog.source,
      journalEntryId: safetyLog.journalEntryId,
      questionnaireResponseId: safetyLog.questionnaireResponseId,
      tier: safetyLog.tier,
      classifierVersion: safetyLog.classifierVersion,
      createdAt: safetyLog.createdAt,
      reviewed: safetyLog.reviewed,
      reviewerNotes: safetyLog.reviewerNotes,
      encryptedBody: journalEntries.encryptedBody,
      purgedAt: journalEntries.purgedAt,
    })
    .from(safetyLog)
    .leftJoin(journalEntries, eq(safetyLog.journalEntryId, journalEntries.id))
    .orderBy(desc(safetyLog.createdAt));

  const decoded = rows.map((row) => {
    let content: string | null = null;

    // A purged entry has no body by design — the safety record outlives the
    // content it describes. Say so rather than rendering a blank cell that
    // looks like a bug.
    if (row.purgedAt) {
      content = "[content permanently deleted]";
    } else if (row.encryptedBody) {
      try {
        content = decrypt(row.encryptedBody);
      } catch (err) {
        content = "[decrypt error]";
        console.error(
          `Safety-log decrypt failed for journal entry ${row.journalEntryId}:`,
          err instanceof Error ? err.message : err
        );
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
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium">Entry</th>
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
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        SOURCE_STYLES[row.source] ?? "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {SOURCE_LABELS[row.source] ?? row.source}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-stone-500 whitespace-nowrap text-xs">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-stone-400">
                    {(row.journalEntryId ?? row.questionnaireResponseId ?? "—").slice(
                      0,
                      8
                    )}
                    …
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
