import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  reportEvaluations,
  summaryEvaluations,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * Exports either evaluation log.
 *
 * ── Two formats, because they carry different things ──────────────────────────
 * CSV is the rubric and its metadata — no journal content at all, so it can be
 * opened in a spreadsheet anywhere without that being a disclosure.
 *
 * JSON additionally carries the decrypted copies and the writers' notes. That is
 * other people's journal text in a file on someone's disk, outside every control
 * the app has. It is offered because judging a model without the text it
 * produced is not possible, and it is deliberately the awkward option: explicit
 * format, its own access-log row.
 *
 * ── Two kinds, never merged into one file ─────────────────────────────────────
 * A summary is judged on four questions and a report on six, three of which have
 * no counterpart. One CSV with half its cells empty would be worse than two.
 *
 * ── Gated here, independently ─────────────────────────────────────────────────
 * The page's requireAdmin() protects the page. A route is its own endpoint and
 * is reachable without ever loading it.
 */
export const dynamic = "force-dynamic";

/** RFC 4180: quote everything, double any embedded quote. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

function csv(columns: readonly string[], rows: unknown[][]): string {
  return [columns.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join(
    "\r\n"
  );
}

const SUMMARY_COLUMNS = [
  "id",
  "created_at",
  "user_id",
  "journal_entry_id",
  "summariser_version",
  "supported",
  "complete",
  "quotes_verbatim",
  "descriptive_only",
  "overall_accuracy",
  "entry_updated_at",
  "has_entry_snapshot",
  "has_summary_snapshot",
  "has_notes",
  "snapshots_cleared_at",
] as const;

const REPORT_COLUMNS = [
  "id",
  "created_at",
  "user_id",
  "mirror_review_id",
  "prompt_version",
  "supported",
  "complete",
  "descriptive_only",
  "no_prediction",
  "hedging_right",
  "figures_untouched",
  "overall_accuracy",
  "has_report_snapshot",
  "has_notes",
  "snapshots_cleared_at",
] as const;

export async function GET(req: Request) {
  const adminId = await requireAdmin();

  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") === "report" ? "report" : "summary";
  const format = params.get("format") === "json" ? "json" : "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  let decrypted = 0;
  const read = (cipher: string | null): string | null => {
    if (!cipher) return null;
    try {
      const plain = decrypt(cipher);
      decrypted++;
      return plain;
    } catch {
      return "[unreadable]";
    }
  };

  let body: string;
  let count: number;

  if (kind === "report") {
    const rows = await db
      .select()
      .from(reportEvaluations)
      .orderBy(desc(reportEvaluations.createdAt));
    count = rows.length;

    body =
      format === "csv"
        ? csv(
            REPORT_COLUMNS,
            rows.map((r) => [
              r.id,
              r.createdAt.toISOString(),
              r.userId,
              r.mirrorReviewId ?? "",
              r.promptVersion,
              r.supported,
              r.complete,
              r.descriptiveOnly,
              r.noPrediction,
              // Blank, not "false": null means there was nothing to judge.
              r.hedgingRight === null ? "" : r.hedgingRight,
              r.figuresUntouched === null ? "" : r.figuresUntouched,
              r.overallAccuracy,
              Boolean(r.encryptedReportSnapshot),
              Boolean(r.encryptedNotes),
              r.snapshotsClearedAt?.toISOString() ?? "",
            ])
          )
        : JSON.stringify(
            rows.map((r) => ({
              id: r.id,
              createdAt: r.createdAt.toISOString(),
              userId: r.userId,
              mirrorReviewId: r.mirrorReviewId,
              promptVersion: r.promptVersion,
              rubric: {
                supported: r.supported,
                complete: r.complete,
                descriptiveOnly: r.descriptiveOnly,
                noPrediction: r.noPrediction,
                hedgingRight: r.hedgingRight,
                figuresUntouched: r.figuresUntouched,
                overallAccuracy: r.overallAccuracy,
              },
              snapshotsClearedAt: r.snapshotsClearedAt?.toISOString() ?? null,
              report: read(r.encryptedReportSnapshot),
              notes: read(r.encryptedNotes),
            })),
            null,
            2
          );
  } else {
    const rows = await db
      .select()
      .from(summaryEvaluations)
      .orderBy(desc(summaryEvaluations.createdAt));
    count = rows.length;

    body =
      format === "csv"
        ? csv(
            SUMMARY_COLUMNS,
            rows.map((r) => [
              r.id,
              r.createdAt.toISOString(),
              r.userId,
              r.journalEntryId ?? "",
              r.summariserVersion,
              r.supported,
              r.complete,
              r.quotesVerbatim === null ? "" : r.quotesVerbatim,
              r.descriptiveOnly,
              r.overallAccuracy,
              r.entryUpdatedAt?.toISOString() ?? "",
              Boolean(r.encryptedEntrySnapshot),
              Boolean(r.encryptedSummarySnapshot),
              Boolean(r.encryptedNotes),
              r.snapshotsClearedAt?.toISOString() ?? "",
            ])
          )
        : JSON.stringify(
            rows.map((r) => ({
              id: r.id,
              createdAt: r.createdAt.toISOString(),
              userId: r.userId,
              journalEntryId: r.journalEntryId,
              summariserVersion: r.summariserVersion,
              rubric: {
                supported: r.supported,
                complete: r.complete,
                quotesVerbatim: r.quotesVerbatim,
                descriptiveOnly: r.descriptiveOnly,
                overallAccuracy: r.overallAccuracy,
              },
              entryUpdatedAt: r.entryUpdatedAt?.toISOString() ?? null,
              snapshotsClearedAt: r.snapshotsClearedAt?.toISOString() ?? null,
              summary: parseMaybe(read(r.encryptedSummarySnapshot)),
              entry: read(r.encryptedEntrySnapshot),
              notes: read(r.encryptedNotes),
            })),
            null,
            2
          );
  }

  await logExport(
    adminId,
    `${kind}, ${format}, ${count} assessments, ${decrypted} fields decrypted`
  );

  return new Response(body, {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-evals-${stamp}.${format}"`,
    },
  });
}

/** The summary snapshot is stored as JSON; return it parsed where it parses. */
function parseMaybe(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** One row per export, carrying the count. Never one per record. */
async function logExport(adminId: string, detail: string) {
  try {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId: adminId,
      journalEntryId: null,
      context: `admin_evals_export (${detail})`,
    });
  } catch (err) {
    console.error(
      "Evals export log failed:",
      err instanceof Error ? err.message : err
    );
  }
}
