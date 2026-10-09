/**
 * Which stretch of time the charts are showing.
 *
 * ── Why this replaced a constant ──────────────────────────────────────────────
 * Trends looked back a fixed 90 days, which had two problems. A fortnightly
 * instrument fitted about six readings into it and a quarterly one fitted *one* —
 * so the Personal Wellbeing Index could never reach the five readings a line
 * needs, however long someone used the app. And there was no way to look at a
 * year, or at everything.
 *
 * The product owner's set: a custom range, one month, this year so far, and
 * everything. One month by default.
 *
 * ── It lives in the URL ───────────────────────────────────────────────────────
 * Like the Mirror tab already does. A view survives a reload, can be linked, and
 * — the practical reason — the server can read it, which is where the decryption
 * and the filtering happen. Client state would mean shipping every reading to the
 * browser to filter it there.
 *
 * ── Nothing here is a limit on what is read ───────────────────────────────────
 * The loader already reads every response and decrypts all of them; the range
 * selects which ones are drawn. "Total" is therefore not a bigger query than
 * "1 month" — it is the same query with nothing filtered out.
 */

export const RANGE_KEYS = ["1m", "ytd", "total", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "1m";

export type TrendRange = {
  key: RangeKey;
  /** Null means unbounded in that direction. */
  from: Date | null;
  to: Date | null;
};

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value);
}

/** `YYYY-MM-DD` from a date's local parts. Never `toISOString`, which is UTC. */
export function dateInputValue(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Parses `YYYY-MM-DD` as local midnight.
 *
 * `new Date("2026-10-09")` parses as UTC midnight, which in any timezone behind
 * UTC is the previous evening — so a record from the 9th would fall outside a
 * range starting on the 9th. Constructed from parts instead.
 */
function parseDay(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The end of a day, so a record recorded that afternoon is inside the range. */
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Resolves the range from the URL.
 *
 * Anything unparseable falls back to the default rather than erroring — a
 * hand-edited URL should land somewhere sensible, and there is nothing here worth
 * refusing over.
 *
 * A `custom` key with no usable dates also falls back, so the picker cannot leave
 * someone looking at an empty chart with no explanation.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date()
): TrendRange {
  const key = isRangeKey(params.range) ? params.range : DEFAULT_RANGE;

  if (key === "custom") {
    const from = parseDay(params.from);
    const to = parseDay(params.to);
    if (from || to) {
      return { key, from, to: to ? endOfDay(to) : null };
    }
    return resolveRange({ range: DEFAULT_RANGE }, now);
  }

  if (key === "total") return { key, from: null, to: null };

  if (key === "ytd") {
    return { key, from: new Date(now.getFullYear(), 0, 1), to: null };
  }

  // One month back, by calendar month rather than 30 days — "a month" means the
  // same date last month, which is what someone picking "1 month" expects.
  const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { key, from, to: null };
}

/** True when a reading falls inside the range. */
export function inRange(at: Date, range: TrendRange): boolean {
  if (range.from && at < range.from) return false;
  if (range.to && at > range.to) return false;
  return true;
}
