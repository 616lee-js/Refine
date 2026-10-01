import { randomUUID } from "crypto";
import { after } from "next/server";
import { and, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  journalEntries,
  questionnaireResponses,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { dailyCheckin, sanitiseAnswers, type Answers } from "@/lib/questionnaires";
import { loadMonth, monthFrom } from "@/lib/journal/month";
import { ScreenHome } from "./home";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Home — the data behind ScreenHome.
 *
 * ── What it reads, and what it no longer reads ────────────────────────────────
 * A draft's title, and today's check-in answers so the fields on Home can be
 * edited rather than duplicated. Nothing else is decrypted.
 *
 * The four-row recent list that used to live here decrypted a summary per row for
 * its categories. The calendar that replaced it needs dates and kinds only, so
 * that decryption is gone rather than moved — see lib/journal/month.ts.
 */

/** Rough relative phrasing. Precise enough for a sentence, no library needed. */
function relativeDay(then: Date, now: Date): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `in ${then.toLocaleDateString(undefined, { month: "long" })}`;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Late";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const authSession = await getSession();
  const userId = authSession.userId!;
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const { month: monthParam } = await searchParams;
  const monthStart = monthFrom(monthParam, now);

  const [entries, checkinsToday, totals, month] = await Promise.all([
    db
      .select({
        id: journalEntries.id,
        createdAt: journalEntries.createdAt,
        updatedAt: journalEntries.updatedAt,
        completedAt: journalEntries.completedAt,
        encryptedTitle: journalEntries.encryptedTitle,
        hasBody: isNotNull(journalEntries.encryptedBody),
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
          isNull(journalEntries.purgedAt)
        )
      )
      .orderBy(desc(journalEntries.updatedAt))
      .limit(20),

    // Today's check-in, with its answers: Home now holds the four fields itself,
    // so an existing answer has to come back to be edited rather than replaced.
    db
      .select({
        id: questionnaireResponses.id,
        encryptedAnswers: questionnaireResponses.encryptedAnswers,
      })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, userId),
          eq(questionnaireResponses.questionnaireSlug, "daily_checkin"),
          isNotNull(questionnaireResponses.completedAt),
          gte(questionnaireResponses.completedAt, startOfToday),
          isNull(questionnaireResponses.deletedAt),
          isNull(questionnaireResponses.purgedAt)
        )
      )
      .orderBy(desc(questionnaireResponses.completedAt))
      .limit(1),

    // Counted rather than derived from the lists above, which are capped — the
    // continuity line states a total and must not quietly stop at 20.
    Promise.all([
      db
        .select({ n: count() })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.userId, userId),
            isNotNull(journalEntries.completedAt),
            isNull(journalEntries.deletedAt),
            isNull(journalEntries.purgedAt)
          )
        ),
      db
        .select({ n: count() })
        .from(questionnaireResponses)
        .where(
          and(
            eq(questionnaireResponses.userId, userId),
            isNotNull(questionnaireResponses.completedAt),
            isNull(questionnaireResponses.deletedAt),
            isNull(questionnaireResponses.purgedAt)
          )
        ),
    ]),

    loadMonth(userId, monthStart, now),
  ]);

  const totalRecords = (totals[0][0]?.n ?? 0) + (totals[1][0]?.n ?? 0);

  const completedEntries = entries.filter((e) => e.completedAt !== null);

  // An unfinished entry only counts as one worth resuming if there is writing in
  // it. An empty draft is reused silently by POST /api/reflections, so surfacing
  // it here would be offering to resume a blank page.
  const draft = entries.find((e) => e.completedAt === null && e.hasBody);

  /*
   * Today's check-in answers, for the four fields on Home.
   *
   * The only decryption on this screen now. The recent list that used to sit here
   * decrypted a summary per row to show its categories; the calendar that replaced
   * it reads dates and kinds only. This is one record, the reader's own, from
   * today, which they are about to edit.
   */
  let todaysAnswers: Answers = {};
  if (checkinsToday[0]?.encryptedAnswers) {
    try {
      const parsed = JSON.parse(
        decrypt(checkinsToday[0].encryptedAnswers)
      ) as { answers?: Answers };
      todaysAnswers = sanitiseAnswers(dailyCheckin, parsed.answers ?? {});
    } catch {
      // Unreadable: the fields open empty rather than the page failing. Saving
      // then writes a fresh answer over a record that could not be read, which is
      // the better of the two outcomes.
    }
  }

  // Logged because something was decrypted, once, with a count — the rule
  // everywhere else in this codebase. after() so it never delays the render.
  if (checkinsToday[0]?.encryptedAnswers) {
    after(async () => {
      await db.insert(contentAccessLog).values({
        id: randomUUID(),
        userId,
        questionnaireResponseId: checkinsToday[0].id,
        context: "home_checkin_prefill (1 record read)",
      });
    });
  }

  // Sorted by completion, not by `updated_at` — editing an old entry today does
  // not mean you wrote today, and the line would be a small lie if it did.
  const lastCompleted =
    completedEntries
      .map((e) => e.completedAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return (
    <ScreenHome
      admin={<AdminNav />}
      greeting={greetingFor(now.getHours())}
      lastWrote={lastCompleted ? relativeDay(lastCompleted, now) : null}
      unfinished={
        draft
          ? {
              id: draft.id,
              title: safeDecrypt(draft.encryptedTitle),
              when: relativeDay(draft.updatedAt, now),
            }
          : null
      }
      checkin={{
        questionnaire: dailyCheckin,
        initialAnswers: todaysAnswers,
        alreadyToday: checkinsToday.length > 0,
      }}
      month={month}
      totalRecords={totalRecords}
    />
  );
}
