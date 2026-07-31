/**
 * Cabinet 2 — the shape stored inside `journal_entry_summaries.encrypted_content`.
 *
 * One encrypted blob rather than a column per field: everything here is
 * ciphertext, so per-field columns buy nothing SQL can filter on, and Phase 6
 * will want fields nobody has thought of yet. Same reasoning as
 * `questionnaire_responses.encrypted_answers`.
 *
 * ── Who reads which field ─────────────────────────────────────────────────────
 * `summary`  Layer 4 context assembly. Internal — never rendered as prose to
 *            the user, because it is a machine's description of them.
 * `topics`   thread candidates for Mirror. USER-FACING.
 * `people`   fact candidates for memory extraction. USER-FACING once proposed
 *            memory lands, since a proposed fact is shown for confirmation.
 * `quotes`   the writer's own words, shown back to them. USER-FACING.
 * `thin`     honesty signal. A fifteen-word entry must not be padded into
 *            something that looks substantial; downstream under-weights it.
 */

export type SummaryQuote = {
  /** Verbatim fragment, exactly as the writer typed it. */
  text: string;
  /**
   * Character offset into the entry body, or null when the quote could not be
   * located. Computed here with indexOf — never taken from the model, which
   * cannot count characters reliably.
   */
  offset: number | null;
};

export type EntrySummary = {
  summary: string;
  topics: string[];
  people: string[];
  quotes: SummaryQuote[];
  thin: boolean;
};

/** What the model is asked to return, before offsets are attached. */
export type RawSummary = {
  summary: string;
  topics: string[];
  people: string[];
  quotes: string[];
  thin: boolean;
};

export const MAX_TOPICS = 5;
export const MAX_PEOPLE = 5;
export const MAX_QUOTES = 3;
export const MAX_SUMMARY_CHARS = 600;
