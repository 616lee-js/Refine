import { and, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire } from "@/lib/questionnaires";
import { ScreenHome, type RecentRow } from "./home";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Home — the data behind ScreenHome.
 *
 * Only titles are decrypted, never bodies: the same rule the archive follows,
 * for the same reason. See src/app/(protected)/reflections/page.tsx.
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

export default async function HomePage() {
  const authSession = await getSession();
  const userId = authSession.userId!;
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const [entries, responses, checkinsToday, totals] = await Promise.all([
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

    db
      .select({
        id: questionnaireResponses.id,
        slug: questionnaireResponses.questionnaireSlug,
        completedAt: questionnaireResponses.completedAt,
      })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, userId),
          isNotNull(questionnaireResponses.completedAt),
          isNull(questionnaireResponses.deletedAt),
          isNull(questionnaireResponses.purgedAt)
        )
      )
      .orderBy(desc(questionnaireResponses.completedAt))
      .limit(20),

    db
      .select({ id: questionnaireResponses.id })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, userId),
          eq(questionnaireResponses.questionnaireSlug, "daily_checkin"),
          isNotNull(questionnaireResponses.completedAt),
          gte(questionnaireResponses.completedAt, startOfToday),
          isNull(questionnaireResponses.deletedAt)
        )
      )
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
  ]);

  const totalRecords = (totals[0][0]?.n ?? 0) + (totals[1][0]?.n ?? 0);

  const completedEntries = entries.filter((e) => e.completedAt !== null);

  // An unfinished entry only counts as one worth resuming if there is writing in
  // it. An empty draft is reused silently by POST /api/reflections, so surfacing
  // it here would be offering to resume a blank page.
  const draft = entries.find((e) => e.completedAt === null && e.hasBody);

  const recent: RecentRow[] = [
    ...completedEntries.map((e): RecentRow & { sort: number } => {
      const at = e.completedAt!;
      return {
        sort: at.getTime(),
        id: `entry-${e.id}`,
        href: `/reflections/${e.id}`,
        at: relativeDay(at, now),
        title: safeDecrypt(e.encryptedTitle),
        fallback: at.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        kindLabel: "Writing",
        framework: false,
      };
    }),
    ...responses.map((r): RecentRow & { sort: number } => {
      const q = getQuestionnaire(r.slug);
      const tracker = q?.kind === "tracker";
      const at = r.completedAt!;
      return {
        sort: at.getTime(),
        id: `q-${r.id}`,
        href: tracker ? `/checkin/${r.id}` : `/framework/${r.id}`,
        at: relativeDay(at, now),
        title: q?.title ?? r.slug,
        fallback: r.slug,
        kindLabel: q?.shortName ?? r.slug,
        framework: !tracker,
      };
    }),
  ]
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 4);

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
      recent={recent}
      checkedInToday={checkinsToday.length > 0}
      totalRecords={totalRecords}
    />
  );
}
