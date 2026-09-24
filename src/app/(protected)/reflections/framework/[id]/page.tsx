import { notFound, redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog, questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire } from "@/lib/questionnaires";
import { type ArchiveSearchParams } from "../../records";
import { FrameworkRecord } from "./framework-record";

/**
 * A questionnaire response, open in the archive's main view.
 *
 * Reading and editing both happen here, beside the rail. `/framework/[id]`
 * redirects here.
 */

// COPY REVIEW: this message reaches the user through the error boundary.
const COPY = {
  unreadable: "[COPY] This response could not be read and was not opened.",
} as const;

export default async function ArchiveFrameworkPage({
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
  // Captured so the narrowing survives into the after() callback below.
  const userId = authSession.userId;

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

  // Trackers have their own renderer — a check-in response opened here would
  // hit a form expecting uniform response options it does not have.
  if (questionnaire.kind !== "likert") {
    redirect(`/reflections/checkin/${row.id}`);
  }

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
      throw new Error(COPY.unreadable);
    }
  }

  // "Last taken" reads from other completed responses to this instrument.
  const previousRows = await db
    .select({ completedAt: questionnaireResponses.completedAt })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, authSession.userId),
        eq(questionnaireResponses.questionnaireSlug, row.questionnaireSlug),
        isNotNull(questionnaireResponses.completedAt),
        ne(questionnaireResponses.id, id)
      )
    )
    .orderBy(desc(questionnaireResponses.completedAt))
    .limit(1);

  // This response's own answers are a deliberate decryption, logged separately
  // from the rail's single row — that one records reading the list, this one
  // records reading the record.
  /*
   * Off the rendering path. The row is still written — `after()` holds the
   * function open until it lands — but the page no longer waits on a write
   * before it can show the record. See src/lib/after-response.ts.
   */
  after(async () => {
    try {
      await db.insert(contentAccessLog).values({
        id: randomUUID(),
        userId,
        questionnaireResponseId: id,
        context: "questionnaire_detail_view",
      });
    } catch (err) {
      console.error(
        "Questionnaire detail access log failed:",
        err instanceof Error ? err.message : err
      );
    }
  });


  return (
    <>
      <FrameworkRecord
        responseId={row.id}
        questionnaire={questionnaire}
        initialAnswers={answers}
        initialNote={note}
        initialCompleted={row.completedAt !== null}
        initialEditing={row.completedAt === null || sp.edit === "1"}
        lastTakenAt={previousRows[0]?.completedAt?.toISOString() ?? null}
      />
    </>
  );
}
