import { decrypt } from "@/lib/crypto";

/**
 * Resolving which version of a Mirror report counts.
 *
 * ── The person's edit wins ────────────────────────────────────────────────────
 * A report is Refine's account of someone. When they rewrite it, the rewrite is
 * what is true, and the generated version becomes a record of what Refine got
 * wrong rather than something anything downstream should act on.
 *
 * **Everything that reads a report must read through here** — the page, the
 * history, and the next run, which is shown previous reports so it does not
 * repeat itself. A run shown the superseded version would rebuild on an account
 * the person has already corrected.
 *
 * Never read `encryptedReport` or `encryptedUserReport` directly. There is one
 * resolution rule and this is the only place it lives. Deliberately the same
 * shape as `src/lib/summaries/read.ts`, because it is the same rule.
 */

/**
 * A report, in the shape it is written and read.
 *
 * ── Sections are data, not formatting ─────────────────────────────────────────
 * The report breaks out by life area, and the areas have to survive storage,
 * editing and being fed to the next run. There is no markdown renderer anywhere
 * in this project, so `## Health` in a string would display as those characters —
 * and a heading inside a free-text box is one keystroke from being destroyed.
 * Sections are therefore a list with keys, and the keys come from
 * ./domains.ts.
 *
 * ── `figures` are not a section ───────────────────────────────────────────────
 * Check-in numbers reach the report as the exact strings Trends puts on its
 * charts, so a figure in the report and the same figure on a chart cannot
 * disagree. They are kept apart from the model's prose for that reason, and they
 * are not an answer about any one area — a sleep median is not a statement about
 * "health".
 */
export type ReportSection = { domain: string; text: string };

export type StructuredReport = {
  /** What they are actually writing about. Leads the report. */
  overall: string;
  /** Only areas the writing supports. Ordered by ./domains.ts, never by the model. */
  sections: ReportSection[];
  /** Verbatim from Trends. Rendered after the areas, never inside one. */
  figures: string[];
};

export type ResolvedReport = {
  /** What to show, and what the next run reads. The edit where one exists. */
  report: StructuredReport;
  /** Who wrote the version above. */
  source: "ai" | "user";
  /**
   * What Refine generated, always. Identical to `report` until edited; the
   * superseded original afterwards, kept so an edit can be compared against
   * what prompted it and reverted.
   */
  aiOriginal: StructuredReport;
  userEditedAt: Date | null;
};

export type ReportRow = {
  encryptedReport: string;
  encryptedUserReport: string | null;
  userEditedAt: Date | null;
  encryptedPeriodNote: string;
};

export class ReportUnreadableError extends Error {}

/**
 * Reads a stored report, whatever shape it was stored in.
 *
 * ── Why there is no migration ─────────────────────────────────────────────────
 * Reports written before 2026-10-09 are a single block of prose, sometimes with
 * check-in lines appended after a blank line. They are encrypted, so they cannot
 * be rewritten in place without decrypting and re-encrypting every row — and
 * there is nothing to gain by it: an old report is a record of what Refine said
 * at the time, and inventing section boundaries in it after the fact would be
 * putting words in its mouth.
 *
 * So an unsectioned report reads as one with everything in `overall` and no
 * areas. It renders, it can be edited, and it feeds the next run. Nothing has to
 * know which vintage it came from.
 */
export function parseStoredReport(text: string): StructuredReport {
  const empty = { overall: text, sections: [], figures: [] };
  if (!text.trimStart().startsWith("{")) return empty;

  try {
    const o: unknown = JSON.parse(text);
    if (typeof o !== "object" || o === null) return empty;
    const { overall, sections, figures } = o as Record<string, unknown>;
    if (typeof overall !== "string") return empty;

    return {
      overall,
      sections: Array.isArray(sections)
        ? sections.flatMap((s) => {
            if (typeof s !== "object" || s === null) return [];
            const { domain, text: body } = s as Record<string, unknown>;
            if (typeof domain !== "string" || typeof body !== "string") return [];
            return [{ domain, text: body }];
          })
        : [],
      figures: Array.isArray(figures)
        ? figures.filter((f): f is string => typeof f === "string")
        : [],
    };
  } catch {
    // Prose that happens to begin with a brace. Read as prose.
    return empty;
  }
}

/** The stored form. One blob, so the database still sees nothing queryable. */
export function serialiseReport(report: StructuredReport): string {
  return JSON.stringify(report);
}

/** The whole report as one piece of text — for a prompt, or a word count. */
export function reportToText(report: StructuredReport): string {
  return [
    report.overall,
    ...report.sections.map((s) => `${s.domain}: ${s.text}`),
    ...report.figures,
  ]
    .filter((p) => p.trim())
    .join("\n\n");
}

/**
 * Decrypts a report row and resolves which version is authoritative.
 *
 * Throws rather than returning a partial result. Silently showing the generated
 * version to someone who had rewritten it would look entirely normal, which is
 * what makes it worse than an error.
 */
export function authoritativeReport(row: ReportRow): ResolvedReport {
  let aiOriginal: StructuredReport;
  try {
    aiOriginal = parseStoredReport(decrypt(row.encryptedReport));
  } catch {
    throw new ReportUnreadableError("Report could not be decrypted");
  }

  if (!row.encryptedUserReport) {
    return { report: aiOriginal, source: "ai", aiOriginal, userEditedAt: null };
  }

  try {
    return {
      report: parseStoredReport(decrypt(row.encryptedUserReport)),
      source: "user",
      aiOriginal,
      userEditedAt: row.userEditedAt,
    };
  } catch {
    // Their rewrite is the one thing here that cannot be regenerated. Falling
    // back to the generated version would quietly discard it and look fine.
    throw new ReportUnreadableError(
      "The edited report could not be decrypted"
    );
  }
}

/** The short account of one window. Not editable — the report above is. */
export function periodNote(row: ReportRow): string {
  try {
    return decrypt(row.encryptedPeriodNote);
  } catch {
    throw new ReportUnreadableError("Period note could not be decrypted");
  }
}
