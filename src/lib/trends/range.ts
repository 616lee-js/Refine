import {
  DEFAULT_TIME_ZONE,
  dayEnd,
  dayStart,
  localParts,
  parseLocalDay,
  zonedToUtc,
} from "@/lib/time";

/**
 * Which stretch of time the charts are showing.
 *
 * ── Why this replaced a constant ──────────────────────────────────────────────
 * Trends looked back a fixed 90 days, which had two problems. An instrument
 * answered every 14 days fitted about six readings into it and a quarterly one
 * fitted *one* — so the Personal Wellbeing Index could never reach the five
 * readings a line needed, however long someone used the app. And there was no
 * way to look at a year, or at everything.
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
 * ── Days are the person's ─────────────────────────────────────────────────────
 * A typed date is a calendar day in the person's zone, so "from the 9th" starts
 * at their midnight on the 9th, and "this year" starts at their New Year. Until
 * 2026-11-11 these were the server's days — UTC on Vercel. See lib/time.ts.
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
  now: Date = new Date(),
  tz: string = DEFAULT_TIME_ZONE
): TrendRange {
  const key = isRangeKey(params.range) ? params.range : DEFAULT_RANGE;

  if (key === "custom") {
    const from = parseLocalDay(params.from);
    const to = parseLocalDay(params.to);
    if (from || to) {
      return {
        key,
        from: from ? dayStart(from, tz) : null,
        // The end of the day, so a reading recorded that afternoon is inside.
        to: to ? dayEnd(to, tz) : null,
      };
    }
    return resolveRange({ range: DEFAULT_RANGE }, now, tz);
  }

  if (key === "total") return { key, from: null, to: null };

  const p = localParts(now, tz);

  if (key === "ytd") {
    return { key, from: zonedToUtc(tz, p.year, 1, 1), to: null };
  }

  // One month back, by calendar month rather than 30 days — "a month" means the
  // same date last month, which is what someone picking "1 month" expects. A
  // day that does not exist in the previous month (the 31st) rolls forward, as
  // Date arithmetic always has.
  return { key, from: zonedToUtc(tz, p.year, p.month - 1, p.day), to: null };
}

/** True when a reading falls inside the range. */
export function inRange(at: Date, range: TrendRange): boolean {
  if (range.from && at < range.from) return false;
  if (range.to && at > range.to) return false;
  return true;
}
