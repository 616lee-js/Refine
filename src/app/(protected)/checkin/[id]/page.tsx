import { notFound, redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog, questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, type Answers } from "@/lib/questionnaires";
import { CheckinForm, type CheckinSummary } from "./checkin-form";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Below this many prior check-ins, the "N of the last 21 days" count is hidden.
 *
 * Not arbitrary: at one or two entries the line reads as a scoreboard someone is
 * losing, which is precisely the streak mechanic the product forbids. It only
 * becomes a record worth stating once there is a record.
 */
const MIN_HISTORY_FOR_COUNT = 7;

/**
 * How many past check-ins the side panel lists.
 *
 * Bounded because each one is a decryption. Sixty days is enough to cover the
 * panel's widest filter (this month) with room over, and small enough that the
 * page stays a page rather than an archive.
 */
const PANEL_LIMIT = 60;

export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [row] = await db
    .select()
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.id, id),
        eq(questionnaireResponses.userId, authSession.userId)
      )
    )
    .limit(1);

  if (!row || row.purgedAt) notFound();

  const questionnaire = getQuestionnaire(row.questionnaireSlug);
  if (!questionnaire) notFound();

  // A likert response opened here would hit a renderer expecting mixed fields.
  if (questionnaire.kind !== "tracker") redirect(`/framework/${row.id}`);

  let answers: Answers = {};
  if (row.encryptedAnswers) {
    try {
      const parsed = JSON.parse(decrypt(row.encryptedAnswers)) as {
        answers?: Answers;
      };
      answers = parsed.answers ?? {};
    } catch (err) {
      // Fail closed rather than opening an empty form over answers that exist.
      console.error(
        `Check-in answers decrypt failed for ${id}:`,
        err instanceof Error ? err.message : err
      );
      throw new Error("This check-in could not be read and was not opened.");
    }
  }

  const since = new Date(Date.now() - 21 * 86_400_000);

  const [recentRows, history] = await Promise.all([
    // The side panel. Completed only: an abandoned half-form is not a record of
    // a day, and listing one invites finishing it days later.
    db
      .select({
        id: questionnaireResponses.id,
        completedAt: questionnaireResponses.completedAt,
        encryptedAnswers: questionnaireResponses.encryptedAnswers,
      })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, authSession.userId),
          eq(questionnaireResponses.questionnaireSlug, questionnaire.slug),
          isNotNull(questionnaireResponses.completedAt),
          isNull(questionnaireResponses.deletedAt),
          isNull(questionnaireResponses.purgedAt)
        )
      )
      .orderBy(desc(questionnaireResponses.completedAt))
      .limit(PANEL_LIMIT),

    db
      .select({ id: questionnaireResponses.id })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, authSession.userId),
          eq(questionnaireResponses.questionnaireSlug, questionnaire.slug),
          isNotNull(questionnaireResponses.completedAt),
          gte(questionnaireResponses.completedAt, since)
        )
      ),
  ]);

  /*
   * The panel's card summaries.
   *
   * ── One audit row, not N ────────────────────────────────────────────────────
   * Same reasoning as Mirror's Trends view: this is ONE deliberate act by the
   * owner of the data — opening a screen that lists their own check-ins — and a
   * row per response would put sixty entries on the board for a single glance,
   * burying the log in the noise it exists to make visible. The row carries the
   * count. `questionnaireResponseId` stays null because the access is not about
   * any one response.
   */
  let failures = 0;
  const recent: CheckinSummary[] = [];
  for (const r of recentRows) {
    if (!r.completedAt) continue;
    let fields: Answers = {};
    if (r.encryptedAnswers) {
      try {
        fields =
          (JSON.parse(decrypt(r.encryptedAnswers)) as { answers?: Answers })
            .answers ?? {};
      } catch {
        // One unreadable response must not take the panel down. It is listed
        // with no values rather than dropped — the day did happen.
        failures += 1;
      }
    }
    recent.push({
      id: r.id,
      completedAt: r.completedAt.toISOString(),
      answers: fields,
    });
  }

  if (failures > 0) {
    console.error(
      `Check-in panel: ${failures} of ${recentRows.length} responses failed to decrypt for user ${authSession.userId}`
    );
  }

  if (recent.length > 0) {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId: authSession.userId,
      context: `checkin_list_view (${recent.length} responses read)`,
    });
  }

  return (
    <CheckinForm
      admin={<AdminNav />}
      responseId={row.id}
      questionnaire={questionnaire}
      initialAnswers={answers}
      // A completed check-in opens read-only. Editing is deliberate, like an
      // entry: `?edit=1` is what Home's "change it" and the panel's Edit send.
      initialCompleted={row.completedAt !== null}
      initialEditing={row.completedAt === null || edit === "1"}
      recent={recent}
      loggedRecently={
        history.length >= MIN_HISTORY_FOR_COUNT ? history.length : null
      }
      today={new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    />
  );
}
