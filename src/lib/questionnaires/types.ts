/**
 * Questionnaire definitions.
 *
 * ── Definitions live in code, responses live in the database ──────────────────
 * One file per instrument in this directory. Adding a questionnaire is a new
 * file — never a migration, never a seed step, nothing to drift between
 * environments. Instrument wording stays reviewable in a git diff, which is what
 * clinical review needs, and an instrument that cannot be licensed is simply a
 * file that is not added.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 * Some instruments carry items that are safety signals in themselves — PHQ-9
 * item 9 asks about self-harm. `safetyItem` marks those. An instrument with a
 * safety item must not ship until its response path is defined: a scored
 * disclosure needs somewhere to go, and "it appears in a trend chart later" is
 * not somewhere.
 */

export type ResponseOption = {
  /** Stored value. GAD-7 and PHQ-9 both score 0–3 per item. */
  value: number;
  /** Column label, shown once in the header rather than per row. */
  label: string;
};

export type QuestionnaireItem = {
  /** Stable key. Answers are stored against this, never against an index. */
  key: string;
  text: string;
  /**
   * True when answering this item is itself a safety disclosure rather than a
   * symptom rating. Routes through safety_log with source "questionnaire".
   */
  safetyItem?: boolean;
};

export type ScoreBand = {
  /** Inclusive lower bound of the total. */
  min: number;
  /**
   * Plain-language label. Belongs to Mirror's trend reading, NOT to the
   * questionnaire screen — a severity verdict shown the moment someone answers
   * is a diagnosis in everything but name.
   */
  label: string;
};

export type Questionnaire = {
  slug: string;
  /** Bumped whenever wording or scoring changes; stored with every response. */
  version: string;
  /** Instrument name as the user sees it. Not the clinical acronym alone. */
  title: string;
  /** The acronym, for the eyebrow. */
  shortName: string;
  /** e.g. "Over the last two weeks" — the recall window, shown once. */
  recallWindow: string;
  /** One line under the title. Never clinical framing. */
  blurb: string;
  /** Suggested cadence, shown as a chip. Not enforced, never nagged. */
  cadence?: string;
  options: ResponseOption[];
  items: QuestionnaireItem[];
  bands: ScoreBand[];
  /** Whether a free-text note is offered after the items. */
  allowsNote: boolean;
  /**
   * False keeps an instrument out of the product while its definition is
   * reviewed. It stays importable and testable; it just cannot be started.
   */
  shipped: boolean;
};

export type QuestionnaireScoring = {
  total: number;
  band: string;
  /** Per-item values, so a response stays interpretable if scoring changes. */
  items: Record<string, number>;
};

/** Sums the answered items and resolves the band. */
export function score(
  q: Questionnaire,
  answers: Record<string, number>
): QuestionnaireScoring {
  const items: Record<string, number> = {};
  let total = 0;

  for (const item of q.items) {
    const v = answers[item.key];
    if (typeof v === "number") {
      items[item.key] = v;
      total += v;
    }
  }

  const band =
    [...q.bands].sort((a, b) => b.min - a.min).find((b) => total >= b.min)
      ?.label ?? q.bands[0]?.label ?? "";

  return { total, band, items };
}

/**
 * Returns the keys of any safety items the user answered above zero.
 *
 * Deliberately not a boolean: which item fired, and at what value, is the thing
 * a reviewer needs. Callers decide what to do with it — this module does not
 * assume a response path exists.
 */
export function triggeredSafetyItems(
  q: Questionnaire,
  answers: Record<string, number>
): { key: string; value: number }[] {
  return q.items
    .filter((i) => i.safetyItem)
    .map((i) => ({ key: i.key, value: answers[i.key] ?? 0 }))
    .filter((a) => a.value > 0);
}
