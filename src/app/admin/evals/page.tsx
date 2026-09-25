import { randomUUID } from "crypto";
import { after } from "next/server";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  reportEvaluations,
  summaryEvaluations,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { EVAL_SNAPSHOTS_ENABLED, getBooleanSetting } from "@/lib/settings";
import type { EntrySummary } from "@/lib/summaries/types";
import { setCapture, clearSnapshots } from "./actions";
import {
  Aggregates,
  Answer,
  DestroyButton,
  Meta,
  NoContentNote,
  Notes,
  Rating,
  SectionHeading,
  Snapshot,
} from "./shared";

/**
 * Assessments of both things Refine writes: entry summaries, and Mirror reports.
 *
 * ── One page by decision (2026-09-25) ─────────────────────────────────────────
 * They are separate tables because they answer to different rules — a summary is
 * judged on four questions, a report on six, three of which have no counterpart
 * in summarising. But they are read for the same reason and they share one
 * switch, so splitting them across two screens would mean visiting both to know
 * whether anything is drifting.
 *
 * ── Why this page shows journal content when the safety log stopped ───────────
 * The safety log dropped content because verifying a classifier never needed it.
 * Judging a summary against its entry, or a report against what it claims,
 * cannot be done without the text. Different purpose, opposite answer — written
 * down so neither looks like drift.
 *
 * One content_access_log row per view, carrying the total across both sections.
 *
 * ── What the numbers mean ─────────────────────────────────────────────────────
 * Every rubric column is stored so that `true` means the model did the right
 * thing. The aggregates therefore count `false` — the failures — and a rising
 * count is worse, never better.
 *
 * ── This feeds nothing automatically ──────────────────────────────────────────
 * Nothing here is read by the summariser or by the report. Changes come from
 * someone reading this page and editing instructions by hand.
 */

// requireAdmin() forces dynamic rendering via cookies(), but stated explicitly
// so protection never depends on that as a side effect. See CLAUDE.md.
export const dynamic = "force-dynamic";

function shortDate(d: Date): string {
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminEvalsPage() {
  // Gate BEFORE any query runs.
  const adminId = await requireAdmin();

  const [summaryRows, reportRows, capture] = await Promise.all([
    db.select().from(summaryEvaluations).orderBy(desc(summaryEvaluations.createdAt)),
    db.select().from(reportEvaluations).orderBy(desc(reportEvaluations.createdAt)),
    getBooleanSetting(EVAL_SNAPSHOTS_ENABLED, true),
  ]);

  // Decrypt once, here, so the count in the audit row is the real number.
  let decrypted = 0;
  const read = (cipher: string | null): string | null => {
    if (!cipher) return null;
    try {
      const plain = decrypt(cipher);
      decrypted++;
      return plain;
    } catch {
      // One unreadable snapshot must not take down the page. A key mismatch is
      // the usual cause — see the fingerprint note in CLAUDE.md.
      return "[unreadable]";
    }
  };

  const summaries = summaryRows.map((row) => {
    const raw = read(row.encryptedSummarySnapshot);
    let summaryText: string | null = raw;
    if (raw && raw !== "[unreadable]") {
      try {
        const s = JSON.parse(raw) as EntrySummary;
        summaryText = [
          s.summary,
          s.topics?.length ? `categories: ${s.topics.join(", ")}` : null,
          s.people?.length ? `people: ${s.people.join(", ")}` : null,
          ...(s.quotes ?? []).map((q) => `“${q.text}”`),
        ]
          .filter(Boolean)
          .join("\n\n");
      } catch {
        // Leave the raw JSON visible — it is still the thing that was judged.
      }
    }
    return {
      row,
      summaryText,
      entryText: read(row.encryptedEntrySnapshot),
      notes: read(row.encryptedNotes),
    };
  });

  const reports = reportRows.map((row) => ({
    row,
    reportText: read(row.encryptedReportSnapshot),
    notes: read(row.encryptedNotes),
  }));

  const total = summaryRows.length + reportRows.length;

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
        context: `admin_evals_view (${decrypted} fields decrypted across ${total} assessments)`,
      });
    } catch (err) {
      console.error(
        "Evals access log failed:",
        err instanceof Error ? err.message : err
      );
    }
  });

  // Aggregates on the plaintext columns. No decryption — which is what those
  // columns are plaintext for.
  const summaryAgg = new Map<
    string,
    { n: number; ratingTotal: number; f: number[] }
  >();
  for (const r of summaryRows) {
    const a = summaryAgg.get(r.summariserVersion) ?? {
      n: 0,
      ratingTotal: 0,
      f: [0, 0, 0, 0],
    };
    a.n++;
    a.ratingTotal += r.overallAccuracy;
    if (!r.supported) a.f[0]++;
    if (!r.complete) a.f[1]++;
    if (r.quotesVerbatim === false) a.f[2]++;
    if (!r.descriptiveOnly) a.f[3]++;
    summaryAgg.set(r.summariserVersion, a);
  }

  const reportAgg = new Map<
    string,
    { n: number; ratingTotal: number; f: number[] }
  >();
  for (const r of reportRows) {
    const a = reportAgg.get(r.promptVersion) ?? {
      n: 0,
      ratingTotal: 0,
      f: [0, 0, 0, 0, 0, 0],
    };
    a.n++;
    a.ratingTotal += r.overallAccuracy;
    if (!r.supported) a.f[0]++;
    if (!r.complete) a.f[1]++;
    if (!r.descriptiveOnly) a.f[2]++;
    if (!r.noPrediction) a.f[3]++;
    // Only a stated `false` is a failure. NULL means there was nothing to judge.
    if (r.hedgingRight === false) a.f[4]++;
    if (r.figuresUntouched === false) a.f[5]++;
    reportAgg.set(r.promptVersion, a);
  }

  const toRows = (m: typeof summaryAgg) =>
    [...m.entries()].map(([version, a]) => ({
      version,
      n: a.n,
      mean: a.ratingTotal / a.n,
      failures: a.f,
    }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
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
          Evaluations
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          {total} {total === 1 ? "assessment" : "assessments"} across summaries
          and Mirror reports. Every count below is a count of failures — a ✓ is
          the model getting it right. Nothing here changes what anyone is shown.
        </p>
      </div>

      {/* The switch, shared by both. Stated before either section, because it
          governs what the sections can still show later. */}
      <Sheet className="mb-8 px-5 py-4">
        <Eyebrow size={9.5}>Stored content</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          New assessments are{" "}
          <strong style={{ color: "var(--rf-text)" }}>
            {capture ? "storing" : "not storing"}
          </strong>{" "}
          a copy of what they judged. Switching this off leaves existing copies
          alone — destroying those is the separate action below, and it cannot be
          undone.
        </p>
        <p
          className="mt-2"
          style={{ fontSize: "12px", lineHeight: 1.55, color: "var(--rf-text-4)" }}
        >
          It cuts differently for the two kinds. A summary assessment can still
          be understood later by re-reading the entry. A report assessment
          cannot — a report is deletable from Mirror, and once it is gone there
          is nothing left to re-read.
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
        </div>
      </Sheet>

      {/* ── Reports ──────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          title="Mirror reports"
          count={reportRows.length}
          note="Judged on the six rules in the report instructions."
          exportPath="/api/admin/evals/export?kind=report"
        />

        <Aggregates
          heading="Failures by instruction version"
          columns={["unsupp.", "incompl.", "judged", "predicted", "hedging", "figures"]}
          rows={toRows(reportAgg)}
        />

        <div className="flex flex-col gap-3">
          {reports.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
              No report assessments yet.
            </p>
          ) : (
            reports.map(({ row, reportText, notes }) => (
              <Sheet key={row.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Rating value={row.overallAccuracy} />
                    <Answer label="supported" value={row.supported} />
                    <Answer label="complete" value={row.complete} />
                    <Answer label="descriptive" value={row.descriptiveOnly} />
                    <Answer label="no prediction" value={row.noPrediction} />
                    <Answer label="hedging" value={row.hedgingRight} />
                    <Answer label="figures" value={row.figuresUntouched} />
                  </div>
                  {(reportText || notes) && (
                    <DestroyButton id={row.id} kind="report" />
                  )}
                </div>

                <div className="mt-[10px] flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Eyebrow size={9.5}>{shortDate(row.createdAt)}</Eyebrow>
                  <Meta>{row.promptVersion}</Meta>
                  <Meta>user {row.userId.slice(0, 8)}</Meta>
                  {row.mirrorReviewId ? (
                    <Meta>report {row.mirrorReviewId.slice(0, 8)}</Meta>
                  ) : (
                    <span
                      style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
                    >
                      report deleted
                    </span>
                  )}
                  {row.snapshotsClearedAt && (
                    <span
                      style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
                    >
                      content destroyed
                    </span>
                  )}
                </div>

                <Notes text={notes} />
                <Snapshot title="Report as judged" text={reportText} />
                {!reportText && !notes && (
                  <NoContentNote cleared={row.snapshotsClearedAt} />
                )}
              </Sheet>
            ))
          )}
        </div>
      </section>

      {/* ── Summaries ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Entry summaries"
          count={summaryRows.length}
          note="Judged on four questions about one entry and its summary."
          exportPath="/api/admin/evals/export?kind=summary"
        />

        <Aggregates
          heading="Failures by summariser version"
          columns={["unsupp.", "incompl.", "quotes", "charact."]}
          rows={toRows(summaryAgg)}
        />

        <div className="flex flex-col gap-3">
          {summaries.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
              No summary assessments yet.
            </p>
          ) : (
            summaries.map(({ row, summaryText, entryText, notes }) => (
              <Sheet key={row.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Rating value={row.overallAccuracy} />
                    <Answer label="supported" value={row.supported} />
                    <Answer label="complete" value={row.complete} />
                    <Answer label="quotes" value={row.quotesVerbatim} />
                    <Answer label="descriptive" value={row.descriptiveOnly} />
                  </div>
                  {(summaryText || entryText || notes) && (
                    <DestroyButton id={row.id} kind="summary" />
                  )}
                </div>

                <div className="mt-[10px] flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Eyebrow size={9.5}>{shortDate(row.createdAt)}</Eyebrow>
                  <Meta>{row.summariserVersion}</Meta>
                  <Meta>user {row.userId.slice(0, 8)}</Meta>
                  {row.journalEntryId ? (
                    <Link
                      href={`/reflections/${row.journalEntryId}`}
                      className="font-mono transition-opacity hover:opacity-70"
                      style={{ fontSize: "10.5px", color: "var(--rf-admin)" }}
                    >
                      entry {row.journalEntryId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}>
                      entry deleted
                    </span>
                  )}
                  {/* An entry edited after being assessed means the assessment
                      no longer describes the text on screen. */}
                  {row.entryUpdatedAt && row.entryUpdatedAt > row.createdAt && (
                    <span style={{ fontSize: "10.5px", color: "var(--color-error)" }}>
                      entry edited since
                    </span>
                  )}
                  {row.snapshotsClearedAt && (
                    <span style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}>
                      content destroyed
                    </span>
                  )}
                </div>

                <Notes text={notes} />
                <Snapshot title="Summary as judged" text={summaryText} />
                <Snapshot title="Entry as judged" text={entryText} />
                {!summaryText && !entryText && !notes && (
                  <NoContentNote cleared={row.snapshotsClearedAt} />
                )}
              </Sheet>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
