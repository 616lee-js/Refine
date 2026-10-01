import "server-only";

import { and, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries, questionnaireResponses } from "@/lib/db/schema";
import { getQuestionnaire } from "@/lib/questionnaires";
import type {
  CalendarDay,
  CalendarMonth,
  DayKind,
} from "@/app/(protected)/home-calendar";

/**
 * One month of the record, as dates and kinds.
 *
 * ── Nothing is decrypted ──────────────────────────────────────────────────────
 * Two queries, both selecting a timestamp and (for questionnaires) a slug. No
 * bodies, no titles, no summaries. The list this replaced on Home decrypted a
 * summary per row to show its categories; a calendar needs none of that, so it
 * writes no `content_access_log` row.
 *
 * ── Local dates, computed on the server, sent as strings ──────────────────────
 * Every date is turned into `YYYY-MM-DD` here and the component only ever prints
 * strings. A `Date` formatted in a client component renders one way in the
 * server's HTML and another at hydration, which is the mismatch that took the
 * check-in page down.
 *
 * The month boundaries are the server's local midnight rather than UTC, so the
 * grid matches the "logged today" check on Home, which also uses local midnight.
 * Both being the server's clock is the point: two different notions of "today" on
 * one screen is worse than one that is occasionally not the reader's.
 */

/** `YYYY-MM-DD` from a date's local parts — never `toISOString`, which is UTC. */
function localKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `YYYY-MM`. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Which month to show, from `?month=YYYY-MM`.
 *
 * Anything unparseable falls back to the current month rather than erroring — a
 * hand-edited URL should land somewhere sensible, and there is nothing here worth
 * refusing over. Clamped to the current month at the top end: the calendar records
 * what happened, and a month in the future is guaranteed empty.
 */
export function monthFrom(param: string | undefined, now: Date): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!match) return current;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return current;

  const asked = new Date(year, month - 1, 1);
  if (Number.isNaN(asked.getTime())) return current;
  return asked > current ? current : asked;
}

export async function loadMonth(
  userId: string,
  monthStart: Date,
  now: Date
): Promise<CalendarMonth> {
  const nextMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );

  const [entries, responses] = await Promise.all([
    db
      .select({ completedAt: journalEntries.completedAt })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          isNotNull(journalEntries.completedAt),
          isNull(journalEntries.deletedAt),
          isNull(journalEntries.purgedAt),
          gte(journalEntries.completedAt, monthStart),
          lt(journalEntries.completedAt, nextMonth)
        )
      ),

    db
      .select({
        slug: questionnaireResponses.questionnaireSlug,
        completedAt: questionnaireResponses.completedAt,
      })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, userId),
          isNotNull(questionnaireResponses.completedAt),
          isNull(questionnaireResponses.deletedAt),
          isNull(questionnaireResponses.purgedAt),
          gte(questionnaireResponses.completedAt, monthStart),
          lt(questionnaireResponses.completedAt, nextMonth)
        )
      ),
  ]);

  /*
   * A set per day, not a count.
   *
   * Three entries on one Tuesday and one entry on one Wednesday look the same
   * here, deliberately — a number per day would be a score, and the rule across
   * this product is that a record states what happened rather than rating it.
   */
  const byDay = new Map<string, Set<DayKind>>();
  const mark = (at: Date, kind: DayKind) => {
    const key = localKey(at);
    const set = byDay.get(key) ?? new Set<DayKind>();
    set.add(kind);
    byDay.set(key, set);
  };

  for (const e of entries) if (e.completedAt) mark(e.completedAt, "writing");
  for (const r of responses) {
    if (!r.completedAt) continue;
    // A tracker is the daily check-in; everything else is a questionnaire. Taken
    // from the registry rather than from the slug, so a new instrument is
    // classified correctly without touching this.
    const q = getQuestionnaire(r.slug);
    mark(r.completedAt, q?.kind === "tracker" ? "checkin" : "framework");
  }

  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0
  ).getDate();

  const todayKey = localKey(now);
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
    const key = localKey(date);
    days.push({
      date: key,
      dayOfMonth: d,
      kinds: [...(byDay.get(key) ?? [])],
      isToday: key === todayKey,
      isFuture: date > now,
    });
  }

  // Monday first: getDay() is Sunday-based, so Sunday's 0 becomes 6.
  const firstWeekday = (monthStart.getDay() + 6) % 7;

  const previous = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1
  );
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const showingCurrent = monthStart.getTime() === currentMonth.getTime();

  return {
    key: monthKey(monthStart),
    label: monthStart.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    }),
    previousKey: monthKey(previous),
    nextKey: showingCurrent ? null : monthKey(nextMonth),
    leadingBlanks: firstWeekday,
    days,
    anyRecords: byDay.size > 0,
  };
}
