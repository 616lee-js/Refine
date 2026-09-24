import { randomUUID } from "crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { contentAccessLog, summaryEvaluations } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import {
  EVAL_SNAPSHOTS_ENABLED,
  getBooleanSetting,
  setBooleanSetting,
} from "@/lib/settings";
import type { EntrySummary } from "@/lib/summaries/types";

/**
 * Summarisation assessments, newest first.
 *
 * ── Why this page shows journal content when the safety log stopped ───────────
 * The safety log dropped content because verifying a classifier never needed it:
 * a tier and a timestamp answer "was this called right" well enough. Judging a
 * summary against the entry it describes cannot be done without both texts.
 * Different purpose, opposite answer — written down so neither looks like drift.
 *
 * Every view writes one content_access_log row carrying the count, which is what
 * makes that trade visible rather than merely decided.
 *
 * ── What the numbers mean ─────────────────────────────────────────────────────
 * Every rubric boolean is stored so that `true` means the summariser did the
 * right thing. The aggregates below therefore count `false` — the failures — and
 * a rising count is a worse summariser, never a better one.
 *
 * ── This feeds nothing automatically ──────────────────────────────────────────
 * Nothing here is read by the summariser. Changes come from someone reading this
 * page and editing a prompt by hand.
 */

// requireAdmin() forces dynamic rendering via cookies(), but stated explicitly
// so protection never depends on that as a side effect. See CLAUDE.md.
export const dynamic = "force-dynamic";

/**
 * Turns snapshot capture on or off for everyone.
 *
 * Gated separately from the page: a server action is an independently
 * addressable endpoint and does not render through the page or the layout.
 */
async function setCapture(formData: FormData) {
  "use server";
  await requireAdmin();

  const next = formData.get("next");
  if (next !== "on" && next !== "off") return;

  await setBooleanSetting(EVAL_SNAPSHOTS_ENABLED, next === "on");
  revalidatePath("/admin/summary-evals");
}

/**
 * Destroys the stored copies of the entry, the summary and the writer's note.
 *
 * The rubric, the rating and the version survive — the same shape as purging an
 * entry: the content goes, the record that it existed stays. `snapshots_cleared_at`
 * is what distinguishes destroyed from never captured.
 *
 * Permanent. There is no recovery path, by design.
 */
async function clearSnapshots(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = formData.get("id");
  const scope = formData.get("scope");

  const cleared = {
    encryptedEntrySnapshot: null,
    encryptedSummarySnapshot: null,
    encryptedNotes: null,
    snapshotsClearedAt: new Date(),
  };

  if (scope === "all") {
    await db.update(summaryEvaluations).set(cleared);
  } else if (typeof id === "string" && id) {
    await db
      .update(summaryEvaluations)
      .set(cleared)
      .where(eq(summaryEvaluations.id, id));
  } else {
    return;
  }

  revalidatePath("/admin/summary-evals");
}

function Answer({ label, value }: { label: string; value: boolean | null }) {
  // null is "no quotes to judge", never a pass. Shown as its own thing so it
  // cannot be read as either.
  const none = value === null;
  return (
    <span
      className="rounded-full"
      style={{
        padding: "3px 9px",
        fontSize: "10.5px",
        color: none
          ? "var(--rf-text-4)"
          : value
            ? "var(--rf-accent-2)"
            : "var(--color-error)",
        background: none
          ? "transparent"
          : value
            ? "var(--rf-accent-2-soft)"
            : "rgba(163, 58, 37, 0.08)",
        boxShadow: none ? "inset 0 0 0 1px var(--rf-border)" : "none",
      }}
    >
      {label}
      {none ? " n/a" : value ? " ✓" : " ✕"}
    </span>
  );
}

function Snapshot({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <details className="mt-2">
      <summary
        className="cursor-pointer list-none py-1"
        style={{ fontSize: "11.5px", color: "var(--rf-admin)" }}
      >
        {title}
      </summary>
      <p
        className="mt-1 max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-[4px] px-3 py-2"
        style={{
          fontSize: "12.5px",
          lineHeight: 1.6,
          color: "var(--rf-text-2)",
          background: "var(--rf-surface)",
        }}
      >
        {text}
      </p>
    </details>
  );
}

type Row = typeof summaryEvaluations.$inferSelect;

function Assessment({
  row,
  entryText,
  summaryText,
  notes,
}: {
  row: Row;
  entryText: string | null;
  summaryText: string | null;
  notes: string | null;
}) {
  const hasContent = Boolean(entryText || summaryText || notes);

  return (
    <Sheet className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="rounded-full font-mono"
            style={{
              padding: "3px 9px",
              fontSize: "11px",
              color: "var(--rf-paper)",
              background:
                row.overallAccuracy >= 4
                  ? "var(--rf-accent-2)"
                  : row.overallAccuracy <= 2
                    ? "var(--color-error)"
                    : "var(--rf-text-3)",
            }}
          >
            {row.overallAccuracy}/5
          </span>
          <Answer label="supported" value={row.supported} />
          <Answer label="complete" value={row.complete} />
          <Answer label="quotes" value={row.quotesVerbatim} />
          <Answer label="descriptive" value={row.descriptiveOnly} />
        </div>

        {hasContent && (
          <form action={clearSnapshots}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="scope" value="one" />
            <button
              type="submit"
              className="rounded-full transition-colors"
              style={{
                padding: "4px 11px",
                fontSize: "11px",
                color: "var(--color-error)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              Destroy content
            </button>
          </form>
        )}
      </div>

      <div className="mt-[10px] flex flex-wrap items-center gap-x-4 gap-y-1">
        <Eyebrow size={9.5}>
          {row.createdAt.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Eyebrow>
        <span
          className="font-mono"
          style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
        >
          {row.summariserVersion}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
        >
          user {row.userId.slice(0, 8)}
        </span>
        {row.journalEntryId ? (
          <Link
            href={`/reflections/${row.journalEntryId}`}
            className="font-mono transition-opacity hover:opacity-70"
            style={{ fontSize: "10.5px", color: "var(--rf-admin)" }}
          >
            entry {row.journalEntryId.slice(0, 8)}
          </Link>
        ) : (
          <span
            className="font-mono"
            style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
          >
            entry deleted
          </span>
        )}
        {/* An entry edited after being assessed means the assessment no longer
            describes the text on screen. Without this you cannot tell. */}
        {row.entryUpdatedAt && row.entryUpdatedAt > row.createdAt && (
          <span style={{ fontSize: "10.5px", color: "var(--color-error)" }}>
            entry edited since
          </span>
        )}
        {row.snapshotsClearedAt && (
          <span style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}>
            content destroyed{" "}
            {row.snapshotsClearedAt.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      {notes && (
        <p
          className="mt-3 whitespace-pre-wrap"
          style={{
            fontSize: "13.5px",
            lineHeight: 1.6,
            color: "var(--rf-text)",
          }}
        >
          {notes}
        </p>
      )}

      <Snapshot title="Summary as judged" text={summaryText} />
      <Snapshot title="Entry as judged" text={entryText} />

      {!hasContent && !row.snapshotsClearedAt && (
        <p
          className="mt-2"
          style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
        >
          No content captured — snapshots were switched off when this was
          submitted.
        </p>
      )}
    </Sheet>
  );
}

export default async function AdminSummaryEvalsPage() {
  // Gate BEFORE any query runs.
  const adminId = await requireAdmin();

  const [rows, capture] = await Promise.all([
    db
      .select()
      .from(summaryEvaluations)
      .orderBy(desc(summaryEvaluations.createdAt)),
    getBooleanSetting(EVAL_SNAPSHOTS_ENABLED, true),
  ]);

  // Decrypt once, here, so the count below is the real number of decryptions.
  let decrypted = 0;
  const view = rows.map((row) => {
    const read = (cipher: string | null): string | null => {
      if (!cipher) return null;
      try {
        const plain = decrypt(cipher);
        decrypted++;
        return plain;
      } catch {
        // One unreadable snapshot must not take down the page. A key mismatch
        // is the usual cause — see the fingerprint note in CLAUDE.md.
        return "[unreadable]";
      }
    };

    const rawSummary = read(row.encryptedSummarySnapshot);
    let summaryText: string | null = rawSummary;
    if (rawSummary && rawSummary !== "[unreadable]") {
      try {
        const s = JSON.parse(rawSummary) as EntrySummary;
        summaryText = [
          s.summary,
          s.topics?.length ? `categories: ${s.topics.join(", ")}` : null,
          s.people?.length ? `people: ${s.people.join(", ")}` : null,
          ...(s.quotes ?? []).map((q) => `“${q.text}”`),
        ]
          .filter(Boolean)
          .join("\n\n");
      } catch {
        // Leave the raw JSON visible rather than hiding it — it is still the
        // thing that was judged.
      }
    }

    return {
      row,
      entryText: read(row.encryptedEntrySnapshot),
      summaryText,
      notes: read(row.encryptedNotes),
    };
  });

  /*
   * One row per view, carrying the count — never one per record. Off the
   * rendering path via after(), like the entry detail page and Trash.
   */
  after(async () => {
    try {
      await db.insert(contentAccessLog).values({
        id: randomUUID(),
        userId: adminId,
        // Deliberately null: this view spans many entries and several people,
        // so attaching it to one of them would misdescribe what happened.
        journalEntryId: null,
        context: `admin_summary_evals_view (${decrypted} fields decrypted across ${rows.length} assessments)`,
      });
    } catch (err) {
      console.error(
        "Summary evals access log failed:",
        err instanceof Error ? err.message : err
      );
    }
  });

  // Aggregates on the plaintext columns — no decryption, which is what those
  // columns are plaintext for. Counting failures: `false` is the problem case.
  const byVersion = new Map<
    string,
    {
      n: number;
      supported: number;
      complete: number;
      quotes: number;
      descriptive: number;
      ratingTotal: number;
    }
  >();
  for (const r of rows) {
    const agg = byVersion.get(r.summariserVersion) ?? {
      n: 0,
      supported: 0,
      complete: 0,
      quotes: 0,
      descriptive: 0,
      ratingTotal: 0,
    };
    agg.n++;
    if (!r.supported) agg.supported++;
    if (!r.complete) agg.complete++;
    if (r.quotesVerbatim === false) agg.quotes++;
    if (!r.descriptiveOnly) agg.descriptive++;
    agg.ratingTotal += r.overallAccuracy;
    byVersion.set(r.summariserVersion, agg);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
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
          Summary evals
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
        >
          {rows.length} {rows.length === 1 ? "assessment" : "assessments"}.
          Counts below are failures — a ✓ means the summariser got it right.
          Nothing here changes how anyone&apos;s entries are summarised.
        </p>
      </div>

      {/* Per-version tally. The whole reason the rubric is plaintext. */}
      {byVersion.size > 0 && (
        <Sheet className="mb-6 px-5 py-4">
          <Eyebrow size={9.5}>Failures by summariser version</Eyebrow>
          <div className="mt-3 overflow-x-auto">
            <table style={{ fontSize: "12px", width: "100%" }}>
              <thead>
                <tr style={{ color: "var(--rf-text-4)" }}>
                  <th className="pb-1 pr-4 text-left font-normal">Version</th>
                  <th className="pb-1 pr-3 text-right font-normal">n</th>
                  <th className="pb-1 pr-3 text-right font-normal">mean</th>
                  <th className="pb-1 pr-3 text-right font-normal">unsupp.</th>
                  <th className="pb-1 pr-3 text-right font-normal">incompl.</th>
                  <th className="pb-1 pr-3 text-right font-normal">quotes</th>
                  <th className="pb-1 text-right font-normal">charact.</th>
                </tr>
              </thead>
              <tbody>
                {[...byVersion.entries()].map(([version, a]) => (
                  <tr
                    key={version}
                    style={{ borderTop: "1px solid var(--rf-rule)" }}
                  >
                    <td
                      className="py-[6px] pr-4 font-mono"
                      style={{ fontSize: "10.5px", color: "var(--rf-text-2)" }}
                    >
                      {version}
                    </td>
                    <td className="py-[6px] pr-3 text-right">{a.n}</td>
                    <td className="py-[6px] pr-3 text-right">
                      {(a.ratingTotal / a.n).toFixed(1)}
                    </td>
                    <td className="py-[6px] pr-3 text-right">{a.supported}</td>
                    <td className="py-[6px] pr-3 text-right">{a.complete}</td>
                    <td className="py-[6px] pr-3 text-right">{a.quotes}</td>
                    <td className="py-[6px] text-right">{a.descriptive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
      )}

      {/* Snapshot capture and destruction. */}
      <Sheet className="mb-6 px-5 py-4">
        <Eyebrow size={9.5}>Stored content</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          New assessments are{" "}
          <strong style={{ color: "var(--rf-text)" }}>
            {capture ? "storing" : "not storing"}
          </strong>{" "}
          a copy of the entry and the summary they judged. Switching this off
          leaves existing copies alone — destroying those is the separate action
          below, and it cannot be undone.
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
          <form action={setCapture}>
            <input type="hidden" name="next" value={capture ? "off" : "on"} />
            <button
              type="submit"
              className="rounded-full transition-colors"
              style={{
                padding: "6px 13px",
                fontSize: "12px",
                color: capture ? "var(--rf-text-2)" : "var(--rf-paper)",
                background: capture ? "transparent" : "var(--rf-text)",
                boxShadow: capture
                  ? "inset 0 0 0 1px var(--rf-border-strong)"
                  : "none",
              }}
            >
              {capture ? "Stop storing content" : "Start storing content"}
            </button>
          </form>

          <form action={clearSnapshots}>
            <input type="hidden" name="scope" value="all" />
            <button
              type="submit"
              className="rounded-full transition-colors"
              style={{
                padding: "6px 13px",
                fontSize: "12px",
                color: "var(--color-error)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              Destroy all stored content
            </button>
          </form>

          {/* Exports gate themselves; these are links, not authorisation. */}
          <a
            href="/api/admin/summary-evals/export?format=csv"
            className="rounded-full transition-colors"
            style={{
              padding: "6px 13px",
              fontSize: "12px",
              color: "var(--rf-admin)",
              boxShadow: "inset 0 0 0 1px var(--rf-admin-border)",
            }}
          >
            Export CSV (ratings only)
          </a>
          <a
            href="/api/admin/summary-evals/export?format=json"
            className="rounded-full transition-colors"
            style={{
              padding: "6px 13px",
              fontSize: "12px",
              color: "var(--rf-admin)",
              boxShadow: "inset 0 0 0 1px var(--rf-admin-border)",
            }}
          >
            Export JSON (with content)
          </a>
        </div>
      </Sheet>

      <div className="flex flex-col gap-3">
        {view.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
            No assessments yet.
          </p>
        ) : (
          view.map((v) => (
            <Assessment
              key={v.row.id}
              row={v.row}
              entryText={v.entryText}
              summaryText={v.summaryText}
              notes={v.notes}
            />
          ))
        )}
      </div>
    </main>
  );
}
