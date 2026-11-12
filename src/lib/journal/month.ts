import "server-only";

import { and, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries, questionnaireResponses } from "@/lib/db/schema";
import { getQuestionnaire } from "@/lib/questionnaires";
import {
  addMonths,
  dayStart,
  daysInMonth,
  fmtMonthYear,
  localDay,
  monthStartOf,
  parseLocalDay,
  weekdayOf,
  type LocalDay,
} from "@/lib/time";
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
 * ── The person's days, computed on the server, sent as strings ────────────────
 * Every day is a `YYYY-MM-DD` in the PERSON'S zone (see lib/time.ts), and the
 * component only ever prints strings. A `Date` formatted in a client component
 * renders one way in the server's HTML and another at hydration, which is the
 * mismatch that took the check-in page down.
 *
 * Until 2026-11-11 the boundaries were the server's midnight — UTC on Vercel —
 * so an entry finished at 8pm Pacific was marked on the next day's square. The
 * month boundaries, "today" and "future" are all the person's now, and they are
 * the same "today" the rest of Home uses, because the caller passes it in.
 */

/**
 * Which month to show, from `?month=YYYY-MM`, as the local day it starts on.
 *
 * Anything unparseable falls back to the current month rather than erroring — a
 * hand-edited URL should land somewhere sensible, and there is nothing here worth
 * refusing over. Clamped to the current month at the top end: the calendar records
 * what happened, and a month in the future is guaranteed empty.
 */
export function monthFrom(param: string | undefined, today: LocalDay): LocalDay {
  const current = monthStartOf(today);
  const match = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (!match) return current;
  const asked = parseLocalDay(`${match[1]}-${match[2]}-01`);
  if (!asked) return current;
  // Local days compare as text.
  return asked > current ? current : asked;
}

export async function loadMonth(
  userId: string,
  monthStart: LocalDay,
  today: LocalDay,
  tz: string
): Promise<CalendarMonth> {
  const nextMonth = addMonths(monthStart, 1);
  const from = dayStart(monthStart, tz);
  const to = dayStart(nextMonth, tz);

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
          gte(journalEntries.completedAt, from),
          lt(journalEntries.completedAt, to)
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
          gte(questionnaireResponses.completedAt, from),
          lt(questionnaireResponses.completedAt, to)
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
    const key = localDay(at, tz);
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

  const prefix = monthStart.slice(0, 8); // "YYYY-MM-"
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth(monthStart); d++) {
    const key = `${prefix}${String(d).padStart(2, "0")}`;
    days.push({
      date: key,
      dayOfMonth: d,
      kinds: [...(byDay.get(key) ?? [])],
      isToday: key === today,
      isFuture: key > today,
    });
  }

  // Monday first: weekdayOf is Sunday-based, so Sunday's 0 becomes 6.
  const firstWeekday = (weekdayOf(monthStart) + 6) % 7;

  const previous = addMonths(monthStart, -1);
  const showingCurrent = monthStart === monthStartOf(today);

  return {
    key: monthStart.slice(0, 7),
    label: fmtMonthYear(from, tz),
    previousKey: previous.slice(0, 7),
    nextKey: showingCurrent ? null : nextMonth.slice(0, 7),
    leadingBlanks: firstWeekday,
    days,
    anyRecords: byDay.size > 0,
  };
}
