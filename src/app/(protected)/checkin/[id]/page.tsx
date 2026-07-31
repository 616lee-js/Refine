import { notFound, redirect } from "next/navigation";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, type Answers } from "@/lib/questionnaires";
import { CheckinForm } from "./checkin-form";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Below this many prior check-ins, the "N of the last 21 days" count is hidden.
 *
 * Not arbitrary: at one or two entries the line reads as a scoreboard someone is
 * losing, which is precisely the streak mechanic the product forbids. It only
 * becomes a record worth stating once there is a record.
 */
const MIN_HISTORY_FOR_COUNT = 7;

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const recent = await db
    .select({ id: questionnaireResponses.id })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, authSession.userId),
        eq(questionnaireResponses.questionnaireSlug, questionnaire.slug),
        isNotNull(questionnaireResponses.completedAt),
        gte(questionnaireResponses.completedAt, since)
      )
    );

  return (
    <CheckinForm
      admin={<AdminNav />}
      responseId={row.id}
      questionnaire={questionnaire}
      initialAnswers={answers}
      loggedRecently={
        recent.length >= MIN_HISTORY_FOR_COUNT ? recent.length : null
      }
      today={new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    />
  );
}
