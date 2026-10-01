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
 * ── Two kinds, one table ──────────────────────────────────────────────────────
 * `likert`  — GAD-7, PHQ-9. Uniform response options across every item, summed
 *             to a total that resolves to a band.
 * `tracker` — the daily check-in. Mixed field types (a number, two scales, a
 *             set of toggles) and **no total** — summing hours slept to a mood
 *             rating would be arithmetic without meaning.
 *
 * They share `questionnaire_responses` because the storage shape is the same
 * (an encrypted JSON blob of answers), and they share the routes. Only the
 * definition and the renderer differ. That is what "trackers are
 * questionnaires" means in practice.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 * Some items are safety signals in themselves — PHQ-9 item 9 asks about
 * self-harm. `safetyItem` marks those. An instrument with one must not ship
 * until its response path is defined: a scored disclosure needs somewhere to go,
 * and "it appears in a trend chart later" is not somewhere.
 */

// ── Likert instruments ───────────────────────────────────────────────────────

export type ResponseOption = {
  /** Stored value. GAD-7 and PHQ-9 both score 0–3 per item. */
  value: number;
  /** Column label, shown once in the header rather than per row. */
  label: string;
};

export type LikertItem = {
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

// ── Tracker fields ───────────────────────────────────────────────────────────

/** A number the user steps up and down — hours slept. */
export type CountField = {
  kind: "count";
  key: string;
  label: string;
  note?: string;
  min: number;
  max: number;
  step: number;
  /** Rendered after the value, e.g. "h". */
  unit?: string;
};

/** A 1–n step scale — mood, energy. */
export type ScaleField = {
  kind: "scale";
  key: string;
  label: string;
  note?: string;
  steps: number;
  /** Shown under the ends and middle. Three labels, evenly placed. */
  endLabels: [string, string, string];
};

/** A set of independent booleans — what happened today. */
export type TogglesField = {
  kind: "toggles";
  key: string;
  label: string;
  note?: string;
  options: { key: string; label: string }[];
};

export type TrackerField = CountField | ScaleField | TogglesField;

// ── The instrument ───────────────────────────────────────────────────────────

type Common = {
  slug: string;
  /** Bumped whenever wording or scoring changes; stored with every response. */
  version: string;
  /** Instrument name as the user sees it. */
  title: string;
  /** Short form, for the eyebrow. */
  shortName: string;
  /** One line under the title. Never clinical framing. */
  blurb: string;
  /** Suggested cadence, shown as a chip. Not enforced, never nagged. */
  cadence?: string;
  /** Whether a free-text note is offered. */
  allowsNote: boolean;
  /**
   * False keeps an instrument out of the product while its definition is
   * reviewed. It stays importable and readable; it just cannot be started.
   */
  shipped: boolean;
};

export type LikertQuestionnaire = Common & {
  kind: "likert";
  /**
   * True once the item wording has been checked against a primary source.
   *
   * Separate from `shipped` on purpose: `shipped` decides whether an instrument
   * can be *started*, this decides whether its scores can be *charted over
   * time*. A trend line asserts that repeated measurements are comparable and
   * that they measure the named construct — which is false if the items are
   * paraphrased, however plausible the paraphrase. Mirror renders no card for
   * an unverified instrument.
   */
  wordingVerified: boolean;
  /** e.g. "Over the last two weeks" — the recall window, shown once. */
  recallWindow: string;
  options: ResponseOption[];
  items: LikertItem[];
  bands: ScoreBand[];
  /**
   * How the items combine into the score the bands are defined against.
   *
   * `sum` (the default) is GAD-7 and PHQ-9: add the item values. `mean-x10` is
   * the Personal Wellbeing Index: average the items and multiply by ten, giving
   * 0–100. Which one an instrument uses is part of the instrument, not a detail —
   * applying the wrong one produces a number in the right range that means
   * something else entirely.
   */
  scoring?: "sum" | "mean-x10";
  /**
   * The two ends of the scale, where the options themselves are not words.
   *
   * A 0–10 scale labels its options with digits, so the column headers say
   * nothing on their own and the scale needs stating once: `["0 means X",
   * "10 means Y"]`. Instruments whose every option is already a phrase
   * ("Not at all", "Nearly every day") leave this unset.
   */
  scaleAnchors?: [string, string];
};

export type TrackerQuestionnaire = Common & {
  kind: "tracker";
  fields: TrackerField[];
};

export type Questionnaire = LikertQuestionnaire | TrackerQuestionnaire;

// ── Answers ──────────────────────────────────────────────────────────────────

/**
 * A tracker's toggles answer as a record of booleans; everything else a number.
 */
export type AnswerValue = number | Record<string, boolean>;
export type Answers = Record<string, AnswerValue>;

export type QuestionnaireScoring = {
  total: number;
  band: string;
  /** Per-item values, so a response stays interpretable if scoring changes. */
  items: Record<string, number>;
};

/** Highest score the instrument can produce, in whatever unit it scores in. */
export function maxTotal(q: LikertQuestionnaire): number {
  const top = Math.max(...q.options.map((o) => o.value));
  // Averaged scales do not grow with the number of items: every item's top value
  // is the same, so the mean of all of them is that value, ×10.
  if (q.scoring === "mean-x10") return top * 10;
  return q.items.length * top;
}

/**
 * Whether every item has an answer.
 *
 * Read by anything that charts or bands a score, and the reason is a real defect
 * that shipped: `score()` combines only the items actually answered, so a
 * half-finished response produces a low number that is indistinguishable from a
 * genuinely low one. On GAD-7 that reads as less anxiety than was reported; on an
 * averaged scale it is subtler and no better. It was recorded as a known problem
 * in swls.ts and deferred until a score was charted.
 *
 * Partial responses are still stored — someone may finish later — they are simply
 * not treated as measurements.
 */
export function isComplete(q: Questionnaire, answers: Answers): boolean {
  if (q.kind !== "likert") return true;
  return q.items.every((i) => typeof answers[i.key] === "number");
}

/** The band a total falls in, or null when the instrument has no bands. */
export function bandFor(q: LikertQuestionnaire, total: number): string | null {
  return (
    [...q.bands].sort((a, b) => b.min - a.min).find((b) => total >= b.min)
      ?.label ?? null
  );
}

/**
 * Scores a likert instrument and resolves the band.
 *
 * Trackers are not scored: there is no meaningful total across hours slept, a
 * mood rating, and a set of toggles, and inventing one would produce a number
 * that looks like a measurement and isn't.
 *
 * ── Only the answered items are combined ──────────────────────────────────────
 * Which means a partly answered response scores low rather than scoring nothing.
 * That is deliberate — the per-item values are stored alongside, so the response
 * stays interpretable — but it is why `isComplete()` exists and why nothing charts
 * a score without checking it first.
 */
export function score(
  q: Questionnaire,
  answers: Answers
): QuestionnaireScoring | null {
  if (q.kind !== "likert") return null;

  const items: Record<string, number> = {};
  let sum = 0;

  for (const item of q.items) {
    const v = answers[item.key];
    if (typeof v === "number") {
      items[item.key] = v;
      sum += v;
    }
  }

  const answered = Object.keys(items).length;

  /*
   * An averaged scale divides by what was answered, not by the item count.
   *
   * Dividing by the item count would make a missing answer read as a zero — the
   * worst possible value on a satisfaction scale — rather than as absent. The
   * Personal Wellbeing Index's own guidance is to use the mean of the available
   * items, and this matches it. Rounded, because a band is defined against whole
   * numbers and a score of 71.42857 is false precision about a 0–10 judgement.
   */
  const total =
    q.scoring === "mean-x10"
      ? answered === 0
        ? 0
        : Math.round((sum / answered) * 10)
      : sum;

  const band =
    [...q.bands].sort((a, b) => b.min - a.min).find((b) => total >= b.min)
      ?.label ?? q.bands[0]?.label ?? "";

  return { total, band, items };
}

/**
 * Returns any safety items the user answered above zero.
 *
 * Deliberately not a boolean: which item fired, and at what value, is what a
 * reviewer needs. Callers decide what to do with it — this module does not
 * assume a response path exists.
 */
export function triggeredSafetyItems(
  q: Questionnaire,
  answers: Answers
): { key: string; value: number }[] {
  if (q.kind !== "likert") return [];
  return q.items
    .filter((i) => i.safetyItem)
    .map((i) => ({ key: i.key, value: (answers[i.key] as number) ?? 0 }))
    .filter((a) => a.value > 0);
}

/**
 * Accepts only what the instrument defines, and only within its bounds.
 *
 * Everything reaching this comes from a request body, so an unknown key or an
 * out-of-range value is discarded rather than stored.
 */
export function sanitiseAnswers(q: Questionnaire, raw: unknown): Answers {
  if (typeof raw !== "object" || raw === null) return {};
  const input = raw as Record<string, unknown>;
  const out: Answers = {};

  if (q.kind === "likert") {
    const allowed = new Set(q.options.map((o) => o.value));
    for (const item of q.items) {
      const v = input[item.key];
      if (typeof v === "number" && allowed.has(v)) out[item.key] = v;
    }
    return out;
  }

  for (const field of q.fields) {
    const v = input[field.key];
    if (field.kind === "count") {
      if (typeof v === "number" && v >= field.min && v <= field.max) {
        // Snap to the field's step so a crafted 6.37 cannot land in the data.
        out[field.key] = Math.round(v / field.step) * field.step;
      }
    } else if (field.kind === "scale") {
      if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= field.steps) {
        out[field.key] = v;
      }
    } else {
      if (typeof v === "object" && v !== null) {
        const known = new Set(field.options.map((o) => o.key));
        const picked: Record<string, boolean> = {};
        for (const [k, on] of Object.entries(v as Record<string, unknown>)) {
          if (known.has(k) && typeof on === "boolean") picked[k] = on;
        }
        out[field.key] = picked;
      }
    }
  }
  return out;
}
