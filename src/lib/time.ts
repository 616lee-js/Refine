/**
 * Dates and times in the PERSON'S zone — never the host's.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Every date Refine showed was formatted with `toLocaleDateString(undefined, …)`,
 * which uses whatever zone and locale the machine running the code happens to
 * have. Server-rendered pages ran in UTC on Vercel, so an entry finished Monday
 * at 8:54 PM Pacific read "Tuesday, 3:54 AM". Client-rendered pieces used the
 * browser's zone, so the same screen could disagree with itself — and when a
 * client component formatted a date during hydration, React compared the two
 * and tore the page down. Both problems have one cause: no single zone.
 *
 * ── The rule ──────────────────────────────────────────────────────────────────
 * The zone is the person's (`users.time_zone`, recorded from their device — see
 * components/ui/time-zone-sync.tsx). Everything is formatted ON THE SERVER with
 * that zone passed in explicitly, and travels to the browser as finished text.
 * Nothing in this file reads the host's zone or locale, and nothing in a client
 * component should format a date at all.
 *
 * Locale is fixed to en-US so "Oct 12" never becomes "12 Oct" because a server
 * moved. Two-way door.
 *
 * ── Local days ────────────────────────────────────────────────────────────────
 * Anything that buckets by day — "today", the calendar, Trends — needs the day
 * boundaries in the person's zone, not midnight UTC. A local day is a string,
 * `YYYY-MM-DD`, so it compares and sorts as text; `dayStart`/`dayEnd` turn it
 * back into instants for a query.
 *
 * Pure: no database, no React, no `server-only`, so scripts can use it too.
 */

export const LOCALE = "en-US";
export const DEFAULT_TIME_ZONE = "UTC";

/** `YYYY-MM-DD` in some zone. Compares as text. */
export type LocalDay = string;

/** True for a zone name Intl accepts, e.g. "America/Los_Angeles". */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// ── Parts ────────────────────────────────────────────────────────────────────

export type LocalParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
  /** 0 = Sunday, like Date#getDay. */
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** The wall-clock parts of an instant, in a zone. */
export function localParts(at: Date, tz: string): LocalParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(at)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Some engines print midnight as "24" under h23. Normalise.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS.indexOf(map.weekday),
  };
}

// ── Local days ───────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function dayFromUtc(ms: number): LocalDay {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function splitDay(day: LocalDay): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`Not a local day: ${day}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Which calendar day an instant falls on, in a zone. */
export function localDay(at: Date, tz: string): LocalDay {
  const p = localParts(at, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `YYYY-MM-DD` from user input, or null. Nothing else is accepted. */
export function parseLocalDay(value: unknown): LocalDay | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Round-trip through UTC to reject the 31st of a 30-day month.
  return dayFromUtc(Date.UTC(y, mo - 1, d)) === value ? value : null;
}

/**
 * The instant at which a wall-clock time happens in a zone.
 *
 * No library: guess that the wall time is UTC, see what the zone makes of that
 * instant, and correct by the difference — twice, because the first correction
 * can itself cross a daylight-saving boundary. Two passes settle every real
 * case; a wall time that does not exist (the skipped hour in spring) lands on
 * the hour after it, which is what clocks do.
 */
export function zonedToUtc(
  tz: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  const wallOf = (ms: number) => {
    const p = localParts(new Date(ms), tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  };

  /*
   * The zone's offset a day before and a day after the wall time brackets any
   * clock change in between. Applying each gives a candidate instant; the one
   * whose wall clock reads back as what was asked for is the answer.
   *
   *   - Both land (fall-back night, the hour that happens twice): the earlier.
   *   - Neither lands (spring-forward night, the hour that never happens): the
   *     later — 2:30 becomes 3:30, which is what a clock shows after the jump.
   *     A zone that changes at midnight starts that day at 1:00, correctly.
   */
  const DAY = 86_400_000;
  const offsetAt = (ms: number) => wallOf(ms) - ms;
  const before = wanted - offsetAt(wanted - DAY);
  const after = wanted - offsetAt(wanted + DAY);
  const hits = [before, after].filter((c) => wallOf(c) === wanted);
  return new Date(hits.length ? Math.min(...hits) : Math.max(before, after));
}

/** First instant of a local day. */
export function dayStart(day: LocalDay, tz: string): Date {
  const [y, m, d] = splitDay(day);
  return zonedToUtc(tz, y, m, d);
}

/** Last instant of a local day (one millisecond before the next day starts). */
export function dayEnd(day: LocalDay, tz: string): Date {
  return new Date(dayStart(addDays(day, 1), tz).getTime() - 1);
}

export function addDays(day: LocalDay, n: number): LocalDay {
  const [y, m, d] = splitDay(day);
  return dayFromUtc(Date.UTC(y, m - 1, d + n));
}

export function addMonths(day: LocalDay, n: number): LocalDay {
  const [y, m, d] = splitDay(day);
  return dayFromUtc(Date.UTC(y, m - 1 + n, d));
}

/** `YYYY-MM-01` of the month a day is in. */
export function monthStartOf(day: LocalDay): LocalDay {
  const [y, m] = splitDay(day);
  return `${y}-${pad(m)}-01`;
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: LocalDay, b: LocalDay): number {
  const [ay, am, ad] = splitDay(a);
  const [by, bm, bd] = splitDay(b);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000
  );
}

/** 0 = Sunday, like Date#getDay. */
export function weekdayOf(day: LocalDay): number {
  const [y, m, d] = splitDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(day: LocalDay): number {
  const [y, m] = splitDay(day);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ── Formatting ───────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  tz: string,
  key: string,
  opts: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const k = `${tz}|${key}`;
  let f = formatters.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...opts });
    formatters.set(k, f);
  }
  return f;
}

/** "Oct 12, 2026" */
export function fmtDate(at: Date, tz: string): string {
  return formatter(tz, "date", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
}

/** "Oct 12" */
export function fmtDateShort(at: Date, tz: string): string {
  return formatter(tz, "dateShort", { month: "short", day: "numeric" }).format(
    at
  );
}

/** "Mon, Oct 12" */
export function fmtDateWeekday(at: Date, tz: string): string {
  return formatter(tz, "dateWeekday", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** "Monday, October 12" */
export function fmtDateWeekdayLong(at: Date, tz: string): string {
  return formatter(tz, "dateWeekdayLong", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(at);
}

/** "8:54 PM" */
export function fmtTime(at: Date, tz: string): string {
  return formatter(tz, "time", { hour: "numeric", minute: "2-digit" }).format(
    at
  );
}

/** "Oct 12, 8:54 PM" */
export function fmtDateTime(at: Date, tz: string): string {
  return formatter(tz, "dateTime", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** "Oct 12, 2026, 8:54 PM" — admin lists, where the year matters. */
export function fmtDateTimeYear(at: Date, tz: string): string {
  return formatter(tz, "dateTimeYear", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** "October 2026" */
export function fmtMonthYear(at: Date, tz: string): string {
  return formatter(tz, "monthYear", { month: "long", year: "numeric" }).format(
    at
  );
}

/** "October" */
export function fmtMonth(at: Date, tz: string): string {
  return formatter(tz, "month", { month: "long" }).format(at);
}

/** "Wednesday, November 12" from a local day rather than an instant. */
export function fmtLocalDayLong(day: LocalDay, tz: string): string {
  return fmtDateWeekdayLong(dayStart(day, tz), tz);
}
