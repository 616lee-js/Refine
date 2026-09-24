import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { contentAccessLog, summaryEvaluations } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * Exports the summarisation assessment log.
 *
 * ── Two formats because they carry different things ───────────────────────────
 * CSV is the rubric and its metadata — no journal content at all, so it can be
 * opened in a spreadsheet anywhere without that being a disclosure.
 *
 * JSON additionally carries the decrypted snapshots and the writers' notes. That
 * is other people's journal text in a file on someone's disk, outside every
 * control the app has. It is offered because judging a summariser without the
 * text it summarised is not possible, and it is deliberately the awkward option:
 * separate URL, explicit format, its own access-log row.
 *
 * ── Gated here, independently ─────────────────────────────────────────────────
 * The page's requireAdmin() protects the page. A route is its own endpoint and
 * is reachable without ever loading it.
 */
export const dynamic = "force-dynamic";

/** RFC 4180: quote everything, double any embedded quote. Newlines are legal inside quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS = [
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

export async function GET(req: Request) {
  const adminId = await requireAdmin();

  const format = new URL(req.url).searchParams.get("format") === "json"
    ? "json"
    : "csv";

  const rows = await db
    .select()
    .from(summaryEvaluations)
    .orderBy(desc(summaryEvaluations.createdAt));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    // No decryption happens on this path, so no content is accessed — the row
    // below records the export itself, which is worth knowing either way.
    const lines = [
      CSV_COLUMNS.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.createdAt.toISOString(),
          r.userId,
          r.journalEntryId ?? "",
          r.summariserVersion,
          r.supported,
          r.complete,
          // Blank, not "false": null means there were no quotes to judge.
          r.quotesVerbatim === null ? "" : r.quotesVerbatim,
          r.descriptiveOnly,
          r.overallAccuracy,
          r.entryUpdatedAt?.toISOString() ?? "",
          Boolean(r.encryptedEntrySnapshot),
          Boolean(r.encryptedSummarySnapshot),
          Boolean(r.encryptedNotes),
          r.snapshotsClearedAt?.toISOString() ?? "",
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    await logExport(adminId, `csv, ${rows.length} assessments, no content`);

    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="summary-evals-${stamp}.csv"`,
      },
    });
  }

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

  const payload = rows.map((r) => ({
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
    // The summary snapshot is stored as JSON; it is returned as its parsed
    // object so the export is usable, and as the raw string if it will not parse.
    summary: parseMaybe(read(r.encryptedSummarySnapshot)),
    entry: read(r.encryptedEntrySnapshot),
    notes: read(r.encryptedNotes),
  }));

  await logExport(
    adminId,
    `json, ${rows.length} assessments, ${decrypted} fields decrypted`
  );

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="summary-evals-${stamp}.json"`,
    },
  });
}

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
      context: `admin_summary_evals_export (${detail})`,
    });
  } catch (err) {
    console.error(
      "Summary evals export log failed:",
      err instanceof Error ? err.message : err
    );
  }
}
