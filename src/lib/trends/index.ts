import {
  DEFAULT_RANGE,
  inRange,
  type TrendRange,
} from "./range";
import {
  getQuestionnaire,
  isComplete,
  maxTotal,
  type Answers,
  type LikertQuestionnaire,
  type TrackerQuestionnaire,
} from "@/lib/questionnaires";

/**
 * Trends — turning stored responses into the cards Mirror renders.
 *
 * ── The three states ──────────────────────────────────────────────────────────
 * Every card is absent, gathering, or charted, and the difference matters:
 *
 *   absent    the instrument has never been taken. No card, no placeholder —
 *             an empty room teaches people the room is empty, and they stop
 *             opening the door.
 *   gathering 1–4 readings. One line of text, no chart. Absence here would be
 *             dishonest: someone who answered twice and sees nothing will
 *             reasonably conclude it was not recorded.
 *   charted   at threshold. A line through four points is a slope with no
 *             evidence behind it, which is why the threshold exists at all.
 *
 * The threshold counts readings on the WHOLE record, not readings inside the
 * selected range — see `lineCard`. A charted card whose range happens to contain
 * nothing says so, rather than pretending there is no history.
 *
 * ── No causal claims ──────────────────────────────────────────────────────────
 * Nothing here says one thing caused another. `plainly()` states co-occurrence
 * with the count visible, so the reader can see how thin the evidence is. It is
 * a deterministic template, never model-written: interpretive prose about
 * someone's mental-health scores is a Layer 2/3 content decision, not a UI
 * string.
 *
 * ── No arrows, no alarm ───────────────────────────────────────────────────────
 * Movement is described in words, in one colour. A rising anxiety score is not
 * styled as a warning, and nothing here uses "worse".
 */

/**
 * COPY REVIEW — every user-facing string Trends produces.
 *
 * These are deterministic templates, never model-written: interpretive prose
 * about someone's mental-health scores is a Layer 2/3 content decision, not a
 * UI string. That is exactly why they belong in one reviewable block rather
 * than scattered through the builders.
 *
 * Two constraints the wording must keep, whatever the review decides:
 * no causal claims (state co-occurrence, with the count visible), and no
 * severity language — nothing here says "worse".
 */
const COPY = {
  sleepLabel: "[COPY] Sleep · hours",
  sleepMeta: (med: number) => `[COPY] median ${med}h · from daily check-ins`,
  sleepMetaGathering: "[COPY] From daily check-ins",
  moodLabel: "[COPY] Mood",
  moodMeta: "[COPY] 1 low · 5 good",
  energyLabel: "[COPY] Energy",
  energyMeta: "[COPY] 1 empty · 5 full",

  matrixLabel: (field: string, days: number) => `[COPY] ${field} · last ${days} days`,
  matrixGathering: (logged: number, days: number) =>
    `[COPY] ${logged} of the last ${days} days logged`,

  level: (since: string) => `[COPY] level since ${since}`,
  moved: (dir: string, size: number, since: string) =>
    `[COPY] ${dir} ${size} since ${since}`,
  up: "up",
  down: "down",

  bandProvenance: (name: string) =>
    `[COPY] ${name}'s own scoring ranges. A screening tool's category, not a diagnosis.`,

  plainlyCounts: (
    checkins: number,
    readings: number,
    label: string,
    firstValue: number,
    firstAt: string,
    lastValue: number,
    lastAt: string
  ) =>
    `[COPY] You have logged ${checkins} check-ins and ${readings} ${label} readings. ` +
    `The readings run from ${firstValue} on ${firstAt} to ${lastValue} on ${lastAt}.`,
  plainlyCooccurrence: (comparable: number, below: number, med: number) =>
    `[COPY] Of the ${comparable} highest readings with sleep logged around them, ${below} fell in a week whose median sleep was below your overall median of ${med} hours.`,
} as const;

/** A line needs enough points that its direction is not an artefact of two. */
export const MIN_LINE_READINGS = 5;

/** Matches MIN_HISTORY_FOR_COUNT on the check-in screen, for the same reason. */
export const MIN_MATRIX_DAYS = 7;

/** The "Plainly" paragraph makes a cross-signal statement, so it needs both. */
const MIN_PLAINLY_CHECKINS = 21;
const MIN_PLAINLY_READINGS = 2;

const MATRIX_DAYS = 21;

// ── Shapes ───────────────────────────────────────────────────────────────────

export type Reading = { at: Date; value: number };

export type BandKeyRow = { label: string; range: string; from: number };

export type LineCard = {
  kind: "line";
  id: string;
  state: "gathering" | "charted";
  label: string;
  count: number;
  /** Charted only. */
  points: number[];
  labels: string[];
  max: number;
  reading: string;
  note: string | null;
  meta: string;
  /**
   * Rendered as a key beside the chart, never as shading behind the line.
   * Shading makes a threshold look like a property of the person's data; a key
   * keeps it a property of the instrument, which is what it is.
   */
  bandKey: BandKeyRow[] | null;
  provenance: string | null;
  /** Charted cards span both columns when they carry a band key. */
  wide: boolean;
};

export type MatrixRow = { label: string; days: ("yes" | "no" | "none")[] };

export type MatrixCard = {
  kind: "matrix";
  id: string;
  state: "gathering" | "charted";
  label: string;
  count: number;
  rows: MatrixRow[];
  meta: string;
};

export type TrendCard = LineCard | MatrixCard;

export type Trends = {
  cards: TrendCard[];
  /** Null until there is enough of both signals to say anything. */
  plainly: string | null;
  /** How many encrypted responses were read to build this. For the audit log. */
  responsesRead: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Sparse labels — first, middle, last. Labelling every point on a 21-wide chart
 * produces a row of unreadable overlapping text.
 */
function axisLabels(readings: Reading[]): string[] {
  return readings.map((r, i) =>
    i === 0 || i === readings.length - 1 || i === Math.floor(readings.length / 2)
      ? shortDate(r.at)
      : ""
  );
}

/** Movement in words. No arrows, no colour, no "worse". */
function movement(readings: Reading[]): string | null {
  if (readings.length < 2) return null;
  const first = readings[0];
  const last = readings[readings.length - 1];
  const delta = last.value - first.value;
  if (delta === 0) return COPY.level(shortDate(first.at));
  const size = Math.abs(Math.round(delta * 10) / 10);
  return COPY.moved(delta > 0 ? COPY.up : COPY.down, size, shortDate(first.at));
}

// ── Input ────────────────────────────────────────────────────────────────────

/**
 * One decrypted response. The caller does the decryption, because it also owns
 * the audit log — this module never touches the database.
 */
export type DecryptedResponse = {
  slug: string;
  completedAt: Date;
  answers: Answers;
  /** Present for likert instruments only. */
  total: number | null;
};

// ── Card builders ────────────────────────────────────────────────────────────

/**
 * ── Two sets of readings, and the difference is the point ─────────────────────
 * `all` is every reading on record; `shown` is the ones inside the chosen range.
 *
 * The five-reading threshold is applied to `all`, not to `shown`. It existed to
 * stop a slope being drawn through two points and called a trend — but when the
 * window was fixed at 90 days it also meant a fortnightly instrument sat at
 * "gathering" forever and a quarterly one could never escape it at all.
 *
 * Counting over the whole record separates the two questions properly: whether
 * there is enough history for a line to mean anything, and which part of it you
 * are looking at. Narrowing the view is zooming, not claiming less evidence.
 */
function lineCard(opts: {
  id: string;
  label: string;
  all: Reading[];
  shown: Reading[];
  max: number;
  meta: string;
  unit?: string;
  bandKey?: BandKeyRow[] | null;
  provenance?: string | null;
  /** Formats the headline number. */
  format?: (v: number) => string;
}): LineCard | null {
  const { all, shown } = opts;
  if (all.length === 0) return null;

  const base = {
    kind: "line" as const,
    id: opts.id,
    label: opts.label,
    count: all.length,
    max: opts.max,
    bandKey: opts.bandKey ?? null,
    provenance: opts.provenance ?? null,
    wide: Boolean(opts.bandKey),
  };

  if (all.length < MIN_LINE_READINGS) {
    return {
      ...base,
      state: "gathering",
      points: [],
      labels: [],
      reading: "",
      note: null,
      meta: opts.meta,
    };
  }

  // Charted, but nothing falls in the chosen range. The card stays — the history
  // exists and saying so is the honest answer to "show me last month". The panel
  // renders this as a line of text rather than an empty chart.
  if (shown.length === 0) {
    return {
      ...base,
      state: "charted",
      points: [],
      labels: [],
      reading: "",
      note: null,
      meta: opts.meta,
    };
  }

  const last = shown[shown.length - 1].value;
  const fmt = opts.format ?? ((v: number) => String(Math.round(v * 10) / 10));

  return {
    ...base,
    state: "charted",
    points: shown.map((r) => r.value),
    labels: axisLabels(shown),
    // The headline and the movement describe the range on screen, not the whole
    // record — the number under a chart has to be the number the chart shows.
    reading: `${fmt(last)}${opts.unit ?? ""}`,
    note: movement(shown),
    meta: opts.meta,
  };
}

function matrixCard(
  tracker: TrackerQuestionnaire,
  byDay: Map<number, Answers>,
  today: Date
): MatrixCard | null {
  const field = tracker.fields.find((f) => f.kind === "toggles");
  if (!field || field.kind !== "toggles") return null;

  const days: number[] = [];
  for (let i = MATRIX_DAYS - 1; i >= 0; i--) {
    days.push(startOfDay(new Date(today.getTime() - i * 86_400_000)));
  }

  const logged = days.filter((d) => byDay.has(d)).length;
  if (logged === 0) return null;

  const base = {
    kind: "matrix" as const,
    id: `tracker-${field.key}`,
    label: COPY.matrixLabel(field.label, MATRIX_DAYS),
    count: logged,
  };

  if (logged < MIN_MATRIX_DAYS) {
    return {
      ...base,
      state: "gathering",
      rows: [],
      meta: COPY.matrixGathering(logged, MATRIX_DAYS),
    };
  }

  const rows: MatrixRow[] = field.options.map((o) => ({
    label: o.label,
    days: days.map((d) => {
      const answers = byDay.get(d);
      if (!answers) return "none";
      const picked = answers[field.key];
      if (typeof picked !== "object" || picked === null) return "no";
      return picked[o.key] === true ? "yes" : "no";
    }),
  }));

  return {
    ...base,
    state: "charted",
    rows,
    // CONTENT PASS: placeholder. A record of what happened, never a target.
    meta: `${logged} of the last ${MATRIX_DAYS} days logged`,
  };
}

// ── The deterministic reading ────────────────────────────────────────────────

/**
 * CONTENT PASS: all wording below is placeholder.
 *
 * Composed from counted facts only. It states co-occurrence and shows n, so a
 * thin sample reads as thin. It never says one thing caused another, never
 * calls a direction good or bad, and is never generated by a model.
 */
function plainly(
  checkins: DecryptedResponse[],
  sleep: Reading[],
  instrument: { label: string; readings: Reading[] } | null
): string | null {
  if (checkins.length < MIN_PLAINLY_CHECKINS) return null;
  if (!instrument || instrument.readings.length < MIN_PLAINLY_READINGS) {
    return null;
  }

  const parts: string[] = [];
  const first = instrument.readings[0];
  const last = instrument.readings[instrument.readings.length - 1];

  parts.push(
    COPY.plainlyCounts(
      checkins.length,
      instrument.readings.length,
      instrument.label,
      first.value,
      shortDate(first.at),
      last.value,
      shortDate(last.at)
    )
  );

  // Co-occurrence, counted. Not a claim that one produced the other.
  if (sleep.length >= MIN_LINE_READINGS && instrument.readings.length >= 3) {
    const med = median(sleep.map((r) => r.value));
    const sorted = [...instrument.readings].sort((a, b) => b.value - a.value);
    const topN = Math.min(3, Math.floor(sorted.length / 2) || 1);
    const highest = sorted.slice(0, topN);

    // Only readings that HAVE sleep either side of them can be compared. The
    // denominator has to be those, not all of them: saying "0 of 3" when the
    // truth is "we have no sleep logged for those weeks" states an absence of
    // data as a finding, which is the one thing this paragraph must never do.
    const comparable = highest
      .map((reading) => ({
        reading,
        window: sleep.filter(
          (s) =>
            Math.abs(startOfDay(s.at) - startOfDay(reading.at)) <=
            7 * 86_400_000
        ),
      }))
      .filter((c) => c.window.length > 0);

    if (comparable.length > 0) {
      const below = comparable.filter(
        (c) => median(c.window.map((s) => s.value)) < med
      ).length;

      parts.push(
        COPY.plainlyCooccurrence(comparable.length, below, med)
      );
    }
  }

  return parts.join(" ");
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function buildTrends(
  responses: DecryptedResponse[],
  range: TrendRange = { key: DEFAULT_RANGE, from: null, to: null },
  now: Date = new Date()
): Trends {
  /*
   * Everything, in order — not a window.
   *
   * There used to be a 90-day cutoff here and it decided three separate things
   * at once: which points were drawn, whether a card existed, and whether an
   * instrument was visible at all. A quarterly instrument fitted one reading into
   * it, so it could never reach the five a line needs. The range now decides only
   * the first of those.
   */
  const all = [...responses].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
  );

  const allCheckins = all.filter((r) => r.slug === "daily_checkin");
  const checkins = allCheckins.filter((c) => inRange(c.completedAt, range));
  const tracker = getQuestionnaire("daily_checkin");

  /*
   * The habit grid stays on its own 21 days, whatever the range says.
   *
   * It is a grid of one cell per day per habit. At "total" that is a column per
   * day since the person started, which is unreadable, and at a custom week it is
   * five columns. Its label already says "last 21 days", so it is not claiming to
   * follow the selection.
   */
  const matrixSince = now.getTime() - MATRIX_DAYS * 86_400_000;
  const byDay = new Map<number, Answers>();
  for (const c of allCheckins) {
    if (c.completedAt.getTime() < matrixSince) continue;
    // One row per day. A second check-in on the same day replaces the first —
    // the screen is explicitly re-editable, so the latest is what was meant.
    byDay.set(startOfDay(c.completedAt), c.answers);
  }

  const numeric = (rows: DecryptedResponse[], key: string): Reading[] =>
    rows
      .filter((c) => typeof c.answers[key] === "number")
      .map((c) => ({ at: c.completedAt, value: c.answers[key] as number }));

  const sleepAll = numeric(allCheckins, "sleep_hours");
  const sleep = numeric(checkins, "sleep_hours");

  const cards: TrendCard[] = [];

  const sleepCard = lineCard({
    id: "sleep",
    label: COPY.sleepLabel,
    all: sleepAll,
    shown: sleep,
    max: 12,
    unit: "h",
    /*
     * The median describes what is on screen, so it is taken from the range —
     * but only once there is enough history for the card to be charted at all.
     *
     * Both conditions are needed. Without the first, a single check-in produced
     * "median 6.5h", which is a median of one number and reads as a settled
     * figure. Without the second, a charted card whose range is empty would try
     * to take the median of nothing.
     */
    meta:
      sleepAll.length >= MIN_LINE_READINGS && sleep.length > 0
        ? COPY.sleepMeta(median(sleep.map((r) => r.value)))
        : COPY.sleepMetaGathering,
  });
  if (sleepCard) cards.push(sleepCard);

  // Mood and energy share a scale and are read together, so they share a card.
  const moodCard = lineCard({
    id: "mood",
    label: COPY.moodLabel,
    all: numeric(allCheckins, "mood"),
    shown: numeric(checkins, "mood"),
    max: 5,
    meta: COPY.moodMeta,
  });
  if (moodCard) cards.push(moodCard);

  const energyCard = lineCard({
    id: "energy",
    label: COPY.energyLabel,
    all: numeric(allCheckins, "energy"),
    shown: numeric(checkins, "energy"),
    max: 5,
    meta: COPY.energyMeta,
  });
  if (energyCard) cards.push(energyCard);

  // ── Instruments ────────────────────────────────────────────────────────────
  let plainlyInstrument: { label: string; readings: Reading[] } | null = null;

  /*
   * Every instrument ever answered, not just ones answered inside the range.
   *
   * Taken from the whole record because the range is a view. Deriving the slug
   * list from a window meant an instrument whose last answer was 91 days old
   * vanished entirely — no card, not even a count.
   */
  const instrumentSlugs = [
    ...new Set(all.filter((r) => r.slug !== "daily_checkin").map((r) => r.slug)),
  ];

  for (const slug of instrumentSlugs) {
    const q = getQuestionnaire(slug);
    if (!q || q.kind !== "likert") continue;

    /*
     * ── The verification gate moved, it did not go away ──────────────────────
     * This used to `continue` here on any instrument whose wording had not been
     * checked against a primary source — which is all four of them, so no
     * framework has ever been charted.
     *
     * The product owner's reasoning, 2026-10-09: the clinical claim is in the
     * *interpretation*, not in the counting. A line through scores someone
     * recorded asserts nothing about what they mean; printing the instrument's
     * published severity ranges beside it does, and that is the claim a
     * paraphrase actually undermines.
     *
     * So the line is drawn for every instrument, and `instrumentCard` withholds
     * the band key and its provenance line until the wording is verified.
     */

    /*
     * Half-finished responses are not measurements.
     *
     * `score()` combines only the items that were answered, so a response with
     * three of seven filled in produces a genuine-looking low number: on GAD-7 it
     * reads as less anxiety than was reported, on a satisfaction scale as
     * dissatisfaction. Plotted on a line beside complete responses it is
     * indistinguishable from a real dip.
     *
     * This was recorded as a known problem in swls.ts and deferred until a score
     * was actually charted. The Personal Wellbeing Index is the first averaged
     * scale, where it is subtler and no less wrong, so it is fixed here.
     *
     * The response itself is kept — someone may finish it later. It is simply not
     * treated as a reading.
     */
    const readingsAll: Reading[] = all
      .filter(
        (r) =>
          r.slug === slug &&
          typeof r.total === "number" &&
          isComplete(q, r.answers)
      )
      .map((r) => ({ at: r.completedAt, value: r.total as number }));

    const readings = readingsAll.filter((r) => inRange(r.at, range));

    const card = instrumentCard(q, readingsAll, readings);
    if (card) cards.push(card);
    // The "Plainly" paragraph describes what is on screen, so it reads the range.
    if (!plainlyInstrument && readings.length > 0) {
      plainlyInstrument = { label: q.shortName, readings };
    }
  }

  if (tracker?.kind === "tracker") {
    const m = matrixCard(tracker, byDay, now);
    if (m) cards.push(m);
  }

  return {
    cards,
    plainly: plainly(checkins, sleep, plainlyInstrument),
    responsesRead: responses.length,
  };
}

function instrumentCard(
  q: LikertQuestionnaire,
  all: Reading[],
  shown: Reading[]
): LineCard | null {
  const max = maxTotal(q);
  const sorted = [...q.bands].sort((a, b) => a.min - b.min);

  /*
   * ── The band key is where the clinical claim lives ───────────────────────────
   * "moderate 10–14" beside a line says the score means what the instrument says
   * it means. That is exactly the claim an unverified paraphrase cannot support,
   * so it is withheld until the wording has been checked against a primary
   * source — while the line itself, which is only the values the person recorded,
   * is drawn either way.
   *
   * `lineCard` derives `wide` from the presence of a band key, so an unverified
   * instrument also takes one column instead of two. That is correct rather than
   * incidental: there is nothing in the second column to show.
   */
  const bandKey: BandKeyRow[] | null = q.wordingVerified
    ? sorted.map((b, i) => {
        const next = sorted[i + 1];
        return {
          label: b.label,
          range: next ? `${b.min}–${next.min - 1}` : `${b.min}–${max}`,
          from: b.min,
        };
      })
    : null;

  /*
   * Lowercased for mid-sentence use — but not when it still carries a `[COPY]`
   * marker, which `toLowerCase()` turns into a lowercase `[copy]` and makes look
   * like a typo rather than a note to the owner. The marker is meant to be
   * legible on screen; see the Personal Wellbeing Index, whose title and
   * suggested rhythm are both still placeholders.
   */
  const cadence = q.cadence
    ? q.cadence.startsWith("[COPY]")
      ? q.cadence
      : q.cadence.toLowerCase()
    : null;

  return lineCard({
    id: q.slug,
    label: `${q.title} · ${q.shortName}`,
    all,
    shown,
    max,
    // Counts the readings on screen, like every other card's meta line.
    meta: `${shown.length} ${shown.length === 1 ? "reading" : "readings"}${
      cadence ? ` · ${cadence}` : ""
    }`,
    bandKey,
    // CONTENT PASS: placeholder wording. Null alongside the band key it explains.
    provenance: bandKey ? COPY.bandProvenance(q.shortName) : null,
    format: (v) => String(Math.round(v)),
  });
}
