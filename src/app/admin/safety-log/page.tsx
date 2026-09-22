import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safetyLog } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/admin";

/**
 * Safety classification review.
 *
 * ── It shows no journal content ───────────────────────────────────────────────
 * Until 2026-09-21 this page joined `journal_entries`, decrypted every body and
 * offered each one behind a disclosure. That is gone. The purpose of the page is
 * to check whether the classifier is working, and reading what somebody wrote is
 * not needed to do that — a tier, a category, a length and a timestamp are.
 *
 * `safety_log` itself has never stored text (see the table comment in
 * schema.ts); the content came from the join, and removing the join removes it.
 * The FK to the entry stays, so a critical-risk row can still be resolved to its
 * source through a separate, authorised path.
 *
 * Consequence to hold to: **do not reintroduce a decrypt here.** If a future
 * question genuinely cannot be answered without the text, that is a different
 * surface with its own justification, not a column added back to this table.
 */

// requireAdmin() calls getSession() -> cookies(), which already forces dynamic
// rendering — this is here so that protection does not silently depend on that
// side effect. A prerendered admin page would run its authorization once at
// build time instead of once per visitor.
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

const SOURCE_MEANINGS: { key: string; meaning: string }[] = [
  {
    key: "journal_entry",
    meaning:
      "An entry was completed for the first time. The classification describes the writing as submitted.",
  },
  {
    key: "journal_edit",
    meaning:
      "An already-completed entry was edited and re-saved. Expect repeats of an earlier row for the same entry.",
  },
  {
    key: "questionnaire",
    meaning:
      "A scored safety item fired (e.g. PHQ-9 item 9). Not prose — a rating the person selected. These warrant a different response path.",
  },
];

const TIER_COLORS: Record<number, string> = {
  0: "bg-stone-100 text-stone-500",
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-red-100 text-red-700",
};

/**
 * The tier definitions, as the classifier is actually instructed.
 *
 * Kept in step with `src/lib/layer3/tier-classifier-prompt.md` by hand — the
 * prompt is bundled as a string and parsing prose out of it would be a worse
 * dependency than a copy that a reviewer can see. `classifier_version` in each
 * row says which prompt produced it, so a drift between the two is detectable
 * rather than silent.
 */
const TIER_MEANINGS: { tier: number; name: string; meaning: string }[] = [
  {
    tier: 0,
    name: "No distress signals",
    meaning:
      "Normal journaling, reflection, everyday topics. No indicators of emotional struggle.",
  },
  {
    tier: 1,
    name: "Elevated distress",
    meaning:
      "Significant emotional struggle, grief, intense frustration, dark themes, hopelessness tied to a specific situation. A hard emotional place, not crisis. Includes metaphorical language about escaping or withdrawing.",
  },
  {
    tier: 2,
    name: "Concerning indicators",
    meaning:
      "Direct expressions about not wanting to exist or continue, passive ideation, severe sustained hopelessness not tied to a circumstance, references to self-harm or suicide without an active plan.",
  },
  {
    tier: 3,
    name: "Acute risk",
    meaning:
      "Active intent to harm self or others, reference to a specific plan or means, imminent risk, or ongoing severe abuse the person is enduring.",
  },
];

/** Signal metadata, read defensively — `raw_signals` is jsonb and free-form. */
function readSignals(raw: unknown): { chars: number | null; chunks: number | null } {
  if (typeof raw !== "object" || raw === null) return { chars: null, chunks: null };
  const obj = raw as Record<string, unknown>;
  return {
    chars: typeof obj.chars === "number" ? obj.chars : null,
    chunks: typeof obj.chunkCount === "number" ? obj.chunkCount : null,
  };
}

export default async function SafetyLogPage() {
  // Gate BEFORE any query runs.
  await requireAdmin();

  const rows = await db
    .select({
      id: safetyLog.id,
      source: safetyLog.source,
      journalEntryId: safetyLog.journalEntryId,
      questionnaireResponseId: safetyLog.questionnaireResponseId,
      tier: safetyLog.tier,
      classifierVersion: safetyLog.classifierVersion,
      rawSignals: safetyLog.rawSignals,
      createdAt: safetyLog.createdAt,
      reviewed: safetyLog.reviewed,
      reviewerNotes: safetyLog.reviewerNotes,
    })
    .from(safetyLog)
    .orderBy(desc(safetyLog.createdAt));

  // The shell — top nav, background, admin context bar — comes from
  // src/app/admin/layout.tsx. This page renders only its own content.
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 text-stone-800 sm:px-10">
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "27px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
          }}
        >
          Safety log
        </h1>
        <p className="mt-1" style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}>
          {rows.length} {rows.length === 1 ? "classification" : "classifications"},
          newest first. No journal content is shown here — this page exists to
          check that classification is working, not to read what was written.
        </p>
      </div>

      {/* The legend. Open by default: a tier number means nothing without it,
          and a reviewer deciding whether a classification was right needs the
          definition in front of them rather than in another file. */}
      <details open className="mb-8">
        <summary
          className="cursor-pointer list-none py-2"
          style={{ fontSize: "13px", color: "var(--rf-text-2)" }}
        >
          What these classifications mean
        </summary>

        <div
          className="mt-2 rounded-[4px] px-5 py-4"
          style={{
            background: "var(--rf-admin-soft)",
            border: "1px solid var(--rf-admin-border)",
          }}
        >
          <p
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.16em",
              color: "var(--rf-admin)",
            }}
          >
            Tiers
          </p>
          <dl className="mt-3 flex flex-col gap-3">
            {TIER_MEANINGS.map((t) => (
              <div key={t.tier} className="flex gap-3">
                <dt className="shrink-0">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                      TIER_COLORS[t.tier]
                    }`}
                  >
                    T{t.tier}
                  </span>
                </dt>
                <dd style={{ fontSize: "12.5px", lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 500, color: "var(--rf-text)" }}>
                    {t.name}.
                  </span>{" "}
                  <span style={{ color: "var(--rf-text-2)" }}>{t.meaning}</span>
                </dd>
              </div>
            ))}
          </dl>

          <p
            className="mt-5 font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.16em",
              color: "var(--rf-admin)",
            }}
          >
            Sources
          </p>
          <dl className="mt-3 flex flex-col gap-3">
            {SOURCE_MEANINGS.map((s) => (
              <div key={s.key} className="flex gap-3">
                <dt className="shrink-0">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      SOURCE_STYLES[s.key]
                    }`}
                  >
                    {SOURCE_LABELS[s.key]}
                  </span>
                </dt>
                <dd
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.55,
                    color: "var(--rf-text-2)",
                  }}
                >
                  {s.meaning}
                </dd>
              </div>
            ))}
          </dl>

          <p
            className="mt-5"
            style={{
              fontSize: "12px",
              lineHeight: 1.6,
              color: "var(--rf-text-3)",
            }}
          >
            When signals are ambiguous between two adjacent tiers the classifier
            is instructed to choose the higher one — except for common
            metaphorical language (&ldquo;I could just disappear&rdquo;), which
            stays at T1. Over-triggering T2 on idiom is an explicit failure mode,
            so both directions are worth flagging when reviewing.{" "}
            <strong style={{ fontWeight: 500 }}>Classifier</strong> below is the
            prompt version that produced each row; definitions here describe the
            current prompt.
          </p>
        </div>
      </details>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">No safety log entries yet.</p>
      ) : (
        // The table is wide by nature and this is a laptop-first surface, so
        // it scrolls inside its own container rather than widening the page.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-stone-400 border-b border-stone-100">
                <th className="pb-2 pr-4 font-medium">Tier</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium">Record</th>
                <th className="pb-2 pr-4 font-medium">Classifier</th>
                <th className="pb-2 pr-4 font-medium">Length</th>
                <th className="pb-2 pr-4 font-medium">Chunks</th>
                <th className="pb-2 pr-4 font-medium">Reviewed</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {rows.map((row) => {
                const { chars, chunks } = readSignals(row.rawSignals);
                return (
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
                    {/* Recorded at classification time. Rows written before
                        that was added say so rather than showing a blank that
                        looks like a bug. */}
                    <td className="py-3 pr-4 text-xs text-stone-500">
                      {chars !== null ? (
                        `${chars} chars`
                      ) : (
                        <span className="text-stone-300">not recorded</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-stone-500">
                      {chunks !== null ? (
                        chunks
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
