import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire } from "@/lib/questionnaires";
import { FrameworkForm } from "./framework-form";

export default async function FrameworkPage({
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

  // getQuestionnaire, not getStartableQuestionnaire: a response to an instrument
  // that has since been withdrawn must still open, or the user loses access to
  // answers they already gave.
  const questionnaire = getQuestionnaire(row.questionnaireSlug);
  if (!questionnaire) notFound();

  let answers: Record<string, number> = {};
  let note = "";
  if (row.encryptedAnswers) {
    try {
      const parsed = JSON.parse(decrypt(row.encryptedAnswers)) as {
        answers?: Record<string, number>;
        note?: string;
      };
      answers = parsed.answers ?? {};
      note = parsed.note ?? "";
    } catch (err) {
      // Fail closed rather than opening an empty form over answers that exist —
      // saving would overwrite unreadable-but-present responses with blanks.
      console.error(
        `Questionnaire answers decrypt failed for ${id}:`,
        err instanceof Error ? err.message : err
      );
      throw new Error("This response could not be read and was not opened.");
    }
  }

  // "Last taken" reads from completed responses to the same instrument.
  const [previous] = await db
    .select({ completedAt: questionnaireResponses.completedAt })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, authSession.userId),
        eq(questionnaireResponses.questionnaireSlug, row.questionnaireSlug),
        isNotNull(questionnaireResponses.completedAt)
      )
    )
    .orderBy(desc(questionnaireResponses.completedAt))
    .limit(1);

  return (
    <FrameworkForm
      responseId={row.id}
      questionnaire={questionnaire}
      initialAnswers={answers}
      initialNote={note}
      lastTakenAt={previous?.completedAt?.toISOString() ?? null}
    />
  );
}
