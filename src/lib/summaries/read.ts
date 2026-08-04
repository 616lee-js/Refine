import { decrypt } from "@/lib/crypto";
import type { EntrySummary } from "./types";

/**
 * Resolving which summary counts.
 *
 * ── The user's version wins ───────────────────────────────────────────────────
 * A summary is the machine's description of something a person wrote. When they
 * correct it, the correction is what is true — the AI's attempt becomes a record
 * of what it got wrong, not the thing anything downstream should act on.
 *
 * **Everything that consumes Cabinet 2 must read through here.** Phase 6 memory
 * extraction in particular: facts and threads pulled from an uncorrected summary
 * would propagate an error the user has already fixed, into a surface where they
 * would have to fix it a second time.
 *
 * Never read `encryptedContent` or `encryptedUserContent` directly. There is one
 * resolution rule and this is the only place it lives.
 */

export type ResolvedSummary = {
  /** What downstream should use. The user's correction where one exists. */
  summary: EntrySummary;
  /** Who wrote the authoritative version. */
  source: "ai" | "user";
  /**
   * The AI's version, always. Identical to `summary` when untouched; the
   * superseded original once the user has corrected it. Kept so a correction can
   * be compared against what prompted it, and reverted.
   */
  aiOriginal: EntrySummary;
  userEditedAt: Date | null;
};

export type SummaryRow = {
  encryptedContent: string;
  encryptedUserContent: string | null;
  userEditedAt: Date | null;
  generatedAt: Date;
  generationVersion: string;
};

export class SummaryUnreadableError extends Error {}

function parse(ciphertext: string): EntrySummary {
  const obj = JSON.parse(decrypt(ciphertext)) as Partial<EntrySummary>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    topics: Array.isArray(obj.topics) ? obj.topics : [],
    people: Array.isArray(obj.people) ? obj.people : [],
    quotes: Array.isArray(obj.quotes) ? obj.quotes : [],
    thin: obj.thin === true,
  };
}

/**
 * Decrypts a summary row and resolves which version is authoritative.
 *
 * Throws rather than returning a partial result — a caller that silently got the
 * AI version when the user had corrected it would be worse than an error, since
 * nothing about the output would look wrong.
 */
export function authoritativeSummary(row: SummaryRow): ResolvedSummary {
  let aiOriginal: EntrySummary;
  try {
    aiOriginal = parse(row.encryptedContent);
  } catch {
    throw new SummaryUnreadableError("Summary could not be decrypted");
  }

  if (!row.encryptedUserContent) {
    return { summary: aiOriginal, source: "ai", aiOriginal, userEditedAt: null };
  }

  try {
    return {
      summary: parse(row.encryptedUserContent),
      source: "user",
      aiOriginal,
      userEditedAt: row.userEditedAt,
    };
  } catch {
    // The user's correction is the one thing here that cannot be regenerated.
    // Falling back to the AI version would quietly discard it and look fine.
    throw new SummaryUnreadableError(
      "The corrected summary could not be decrypted"
    );
  }
}

/**
 * True when the summary describes a version of the entry that has since changed.
 *
 * Applies to the AI's generation date even when the user has corrected it: their
 * correction was written against the same older text.
 */
export function isStale(row: SummaryRow, entryUpdatedAt: Date): boolean {
  return row.generatedAt.getTime() < entryUpdatedAt.getTime();
}
