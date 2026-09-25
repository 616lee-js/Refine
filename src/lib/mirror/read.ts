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

export type ResolvedReport = {
  /** What to show, and what the next run reads. The edit where one exists. */
  report: string;
  /** Who wrote the version above. */
  source: "ai" | "user";
  /**
   * What Refine generated, always. Identical to `report` until edited; the
   * superseded original afterwards, kept so an edit can be compared against
   * what prompted it and reverted.
   */
  aiOriginal: string;
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
 * Decrypts a report row and resolves which version is authoritative.
 *
 * Throws rather than returning a partial result. Silently showing the generated
 * version to someone who had rewritten it would look entirely normal, which is
 * what makes it worse than an error.
 */
export function authoritativeReport(row: ReportRow): ResolvedReport {
  let aiOriginal: string;
  try {
    aiOriginal = decrypt(row.encryptedReport);
  } catch {
    throw new ReportUnreadableError("Report could not be decrypted");
  }

  if (!row.encryptedUserReport) {
    return { report: aiOriginal, source: "ai", aiOriginal, userEditedAt: null };
  }

  try {
    return {
      report: decrypt(row.encryptedUserReport),
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
