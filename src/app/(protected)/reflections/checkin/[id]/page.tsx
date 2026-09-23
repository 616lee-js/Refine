import { notFound, redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog, questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, type Answers } from "@/lib/questionnaires";
import { ArchiveShell } from "../../archive-shell";
import { loadRail, type ArchiveSearchParams } from "../../records";
import { CheckinRecord } from "./checkin-record";

/**
 * A check-in, open in the archive's main view.
 *
 * Reading and editing both happen here, beside the rail — opening a record no
 * longer navigates to a screen of its own. `/checkin/[id]` redirects here.
 *
 * View and edit stay distinct states: a completed check-in opens read-only and
 * `?edit=1` opens the form. That is what Home's "Log" and the read view's
 * "Edit" both send.
 */

// COPY REVIEW: this message reaches the user through the error boundary.
const COPY = {
  unreadable: "[COPY] This check-in could not be read and was not opened.",
} as const;

/**
 * Below this many prior check-ins, the "N of the last 21 days" count is hidden.
 *
 * At one or two entries the line reads as a scoreboard someone is losing, which
 * is precisely the streak mechanic the product forbids. It only becomes a
 * record worth stating once there is a record.
 */
const MIN_HISTORY_FOR_COUNT = 7;

export default async function ArchiveCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ArchiveSearchParams & { edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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
  if (questionnaire.kind !== "tracker") {
    redirect(`/reflections/framework/${row.id}`);
  }

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
      throw new Error(COPY.unreadable);
    }
  }

  const since = new Date(Date.now() - 21 * 86_400_000);

  const [rail, history] = await Promise.all([
    loadRail(authSession.userId, sp),
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

  // This response's own answers are a deliberate decryption, logged separately
  // from the rail's single row — that one records reading the list, this one
  // records reading the record.
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    questionnaireResponseId: id,
    context: "checkin_detail_view",
  });

  const at = row.completedAt ?? row.createdAt;

  return (
    <ArchiveShell {...rail} selectedId={row.id}>
      <CheckinRecord
        responseId={row.id}
        questionnaire={questionnaire}
        initialAnswers={answers}
        initialCompleted={row.completedAt !== null}
        initialEditing={row.completedAt === null || sp.edit === "1"}
        loggedRecently={
          history.length >= MIN_HISTORY_FOR_COUNT ? history.length : null
        }
        today={at.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />
    </ArchiveShell>
  );
}
