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

/**
 * The cap is the vocabulary itself — see src/lib/summaries/categories.ts. There
 * is no arbitrary limit per entry: the prompt asks for restraint, and a long
 * entry that genuinely ranges across most of the domains may carry them.
 */
export const MAX_TOPICS = 9;
export const MAX_PEOPLE = 5;
/** What the model may pick. */
export const MAX_QUOTES = 3;
/**
 * What the writer may keep when curating. Higher than the model's cap: the
 * model is guessing what matters, the writer knows.
 */
export const MAX_QUOTES_CURATED = 5;

/*
 * There is deliberately no cap on summary length.
 *
 * There was one — 600 characters, applied with a bare `slice()` on both the
 * model's summary and the writer's own correction. It cut mid-word, left no
 * ellipsis, logged nothing and raised nothing, so a long entry's summary simply
 * arrived truncated and a long correction was silently shortened on save. The
 * second of those lost the person's own writing, which is the worse failure of
 * the two and the reason this is a comment rather than a smaller number.
 *
 * What bounds length now is the prompt (summaries/../layer2/entry-summariser.md,
 * which asks the summary to follow the entry and forbids padding) and
 * `max_tokens` in generate.ts as the outer limit. Both fail loudly: a reply that
 * hits the token ceiling fails to parse as JSON and the entry is retried.
 */

/**
 * The most a *person* may type into a summary correction before the request is
 * refused. A refusal limit, not a truncation limit — the distinction is the whole
 * point of this change, so the name says which it is.
 *
 * Generous because a correction is the writer's own words about their own entry,
 * and the same number as the Mirror report editor so the two agree. Exceeding it
 * returns 400 with a reason, matching how an over-long quote is already handled
 * in the same route rather than being quietly shortened.
 */
export const MAX_SUMMARY_INPUT_CHARS = 20_000;
