import {
  getQuestionnaire,
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

/** A line needs enough points that its direction is not an artefact of two. */
export const MIN_LINE_READINGS = 5;

/** Matches MIN_HISTORY_FOR_COUNT on the check-in screen, for the same reason. */
export const MIN_MATRIX_DAYS = 7;

/** The "Plainly" paragraph makes a cross-signal statement, so it needs both. */
const MIN_PLAINLY_CHECKINS = 21;
const MIN_PLAINLY_READINGS = 2;

const MATRIX_DAYS = 21;
const LOOKBACK_DAYS = 90;

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
  if (delta === 0) return `level since ${shortDate(first.at)}`;
  const size = Math.abs(Math.round(delta * 10) / 10);
  return `${delta > 0 ? "up" : "down"} ${size} since ${shortDate(first.at)}`;
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

function lineCard(opts: {
  id: string;
  label: string;
  readings: Reading[];
  max: number;
  meta: string;
  unit?: string;
  bandKey?: BandKeyRow[] | null;
  provenance?: string | null;
  /** Formats the headline number. */
  format?: (v: number) => string;
}): LineCard | null {
  const { readings } = opts;
  if (readings.length === 0) return null;

  const base = {
    kind: "line" as const,
    id: opts.id,
    label: opts.label,
    count: readings.length,
    max: opts.max,
    bandKey: opts.bandKey ?? null,
    provenance: opts.provenance ?? null,
    wide: Boolean(opts.bandKey),
  };

  if (readings.length < MIN_LINE_READINGS) {
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

  const last = readings[readings.length - 1].value;
  const fmt = opts.format ?? ((v: number) => String(Math.round(v * 10) / 10));

  return {
    ...base,
    state: "charted",
    points: readings.map((r) => r.value),
    labels: axisLabels(readings),
    reading: `${fmt(last)}${opts.unit ?? ""}`,
    note: movement(readings),
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
    label: `${field.label} · last ${MATRIX_DAYS} days`,
    count: logged,
  };

  if (logged < MIN_MATRIX_DAYS) {
    return {
      ...base,
      state: "gathering",
      rows: [],
      meta: `${logged} of the last ${MATRIX_DAYS} days logged`,
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
    `You have logged ${checkins.length} check-ins and ${instrument.readings.length} ${instrument.label} readings. ` +
      `The readings run from ${first.value} on ${shortDate(first.at)} to ${last.value} on ${shortDate(last.at)}.`
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
        `Of the ${comparable.length} highest readings with sleep logged around them, ${below} fell in a week whose median sleep was below your overall median of ${med} hours.`
      );
    }
  }

  return parts.join(" ");
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function buildTrends(
  responses: DecryptedResponse[],
  now: Date = new Date()
): Trends {
  const cutoff = now.getTime() - LOOKBACK_DAYS * 86_400_000;
  const inWindow = responses
    .filter((r) => r.completedAt.getTime() >= cutoff)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  const checkins = inWindow.filter((r) => r.slug === "daily_checkin");
  const tracker = getQuestionnaire("daily_checkin");

  // One row per day. A second check-in on the same day replaces the first —
  // the screen is explicitly re-editable, so the latest is what was meant.
  const byDay = new Map<number, Answers>();
  for (const c of checkins) byDay.set(startOfDay(c.completedAt), c.answers);

  const numeric = (key: string): Reading[] =>
    checkins
      .filter((c) => typeof c.answers[key] === "number")
      .map((c) => ({ at: c.completedAt, value: c.answers[key] as number }));

  const sleep = numeric("sleep_hours");
  const mood = numeric("mood");
  const energy = numeric("energy");

  const cards: TrendCard[] = [];

  const sleepCard = lineCard({
    id: "sleep",
    label: "Sleep · hours",
    readings: sleep,
    max: 12,
    unit: "h",
    meta:
      sleep.length >= MIN_LINE_READINGS
        ? `median ${median(sleep.map((r) => r.value))}h · from daily check-ins`
        : "From daily check-ins",
  });
  if (sleepCard) cards.push(sleepCard);

  // Mood and energy share a scale and are read together, so they share a card.
  const moodCard = lineCard({
    id: "mood",
    label: "Mood",
    readings: mood,
    max: 5,
    meta: "1 low · 5 good",
  });
  if (moodCard) cards.push(moodCard);

  const energyCard = lineCard({
    id: "energy",
    label: "Energy",
    readings: energy,
    max: 5,
    meta: "1 empty · 5 full",
  });
  if (energyCard) cards.push(energyCard);

  // ── Instruments ────────────────────────────────────────────────────────────
  let plainlyInstrument: { label: string; readings: Reading[] } | null = null;

  const instrumentSlugs = [
    ...new Set(inWindow.filter((r) => r.slug !== "daily_checkin").map((r) => r.slug)),
  ];

  for (const slug of instrumentSlugs) {
    const q = getQuestionnaire(slug);
    if (!q || q.kind !== "likert") continue;

    // The verification gate. An unverified instrument may not be the instrument
    // it is named after, so a trend of it asserts something unproven.
    if (!q.wordingVerified) continue;

    const readings: Reading[] = inWindow
      .filter((r) => r.slug === slug && typeof r.total === "number")
      .map((r) => ({ at: r.completedAt, value: r.total as number }));

    const card = instrumentCard(q, readings);
    if (card) cards.push(card);
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
  readings: Reading[]
): LineCard | null {
  const max = maxTotal(q);
  const sorted = [...q.bands].sort((a, b) => a.min - b.min);

  const bandKey: BandKeyRow[] = sorted.map((b, i) => {
    const next = sorted[i + 1];
    return {
      label: b.label,
      range: next ? `${b.min}–${next.min - 1}` : `${b.min}–${max}`,
      from: b.min,
    };
  });

  return lineCard({
    id: q.slug,
    label: `${q.title} · ${q.shortName}`,
    readings,
    max,
    meta: `${readings.length} ${readings.length === 1 ? "reading" : "readings"}${
      q.cadence ? ` · ${q.cadence.toLowerCase()}` : ""
    }`,
    bandKey,
    // CONTENT PASS: placeholder wording.
    provenance: `${q.shortName}'s own scoring ranges. A screening tool's category, not a diagnosis.`,
    format: (v) => String(Math.round(v)),
  });
}
