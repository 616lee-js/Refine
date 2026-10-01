import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionnaireResponses } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import {
  getQuestionnaire,
  sanitiseAnswers,
  score,
  triggeredSafetyItems,
} from "@/lib/questionnaires";
import { logSafetyClassification } from "@/lib/safety/classify-and-log";

/**
 * A single questionnaire response.
 *
 * PUT   save progress. No scoring, no completion — this is "Finish later".
 * PATCH record the answers: scores, completes, and routes any safety item.
 *
 * Both answers and scoring are encrypted. A PHQ-9 total of 22 is a clinical
 * datapoint about a person, arguably more sensitive than prose — so it gets the
 * same treatment as the prose.
 */

type Params = { params: Promise<{ id: string }> };

async function loadOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.id, id),
        eq(questionnaireResponses.userId, userId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const row = await loadOwned(id, session.userId);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.purgedAt) return new Response("Gone", { status: 410 });

  const q = getQuestionnaire(row.questionnaireSlug);
  if (!q) return new Response("Unknown instrument", { status: 409 });

  const { answers, note } = body as { answers?: unknown; note?: unknown };
  const clean = sanitiseAnswers(q, answers);

  await db
    .update(questionnaireResponses)
    .set({
      encryptedAnswers: encrypt(
        JSON.stringify({ answers: clean, note: typeof note === "string" ? note : "" })
      ),
      updatedAt: new Date(),
    })
    .where(eq(questionnaireResponses.id, id));

  return Response.json({ savedAt: new Date().toISOString() });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const row = await loadOwned(id, session.userId);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.purgedAt) return new Response("Gone", { status: 410 });

  const q = getQuestionnaire(row.questionnaireSlug);
  if (!q) return new Response("Unknown instrument", { status: 409 });

  const { answers, note } = body as { answers?: unknown; note?: unknown };
  const clean = sanitiseAnswers(q, answers);

  // No required-field blocking: a partly-answered instrument still records.
  // Scoring a partial total is honest as long as the raw items travel with it,
  // which they do.
  // null for trackers — a check-in has no meaningful total, so nothing is
  // written to encrypted_scoring rather than inventing a number.
  const scoring = score(q, clean);
  const now = new Date();

  await db
    .update(questionnaireResponses)
    .set({
      encryptedAnswers: encrypt(
        JSON.stringify({ answers: clean, note: typeof note === "string" ? note : "" })
      ),
      ...(scoring ? { encryptedScoring: encrypt(JSON.stringify(scoring)) } : {}),
      completedAt: row.completedAt ?? now,
      updatedAt: now,
    })
    .where(eq(questionnaireResponses.id, id));

  /*
   * Safety items.
   *
   * An instrument item can be a disclosure rather than a rating — PHQ-9 item 9.
   * Answering one above zero is recorded here with source "questionnaire", so
   * the safety log distinguishes it from something the user wrote in prose.
   *
   * Recording is not responding. The person is shown nothing after such an
   * answer, and that is the intended behaviour rather than an unfinished one:
   * Refine is an isolated reflection log, it carries no escalation path to any
   * external service, and it is not screening anyone. See phq9.ts.
   *
   * **This branch is live.** It previously said PHQ-9 was gated at the registry
   * and that this code did not run — both stopped being true on 2026-09-24 when
   * PHQ-9 shipped. Corrected because a comment claiming a safety path is untested
   * dead code is how a safety path gets removed.
   *
   * It still does not run for GAD-7 or the Personal Wellbeing Index, neither of
   * which has a safety item: GAD-7 is a symptom scale and the PWI is a wellbeing
   * measure, and nothing in either is a disclosure.
   */
  const triggered = triggeredSafetyItems(q, clean);
  if (triggered.length > 0) {
    const tier = triggered.some((t) => t.value >= 2) ? 3 : 2;
    await logSafetyClassification({
      userId: session.userId,
      questionnaireResponseId: id,
      source: "questionnaire",
      tier,
      rawSignals: {
        instrument: q.slug,
        instrumentVersion: q.version,
        // Item key and value only — never the item text or the user's note.
        items: triggered,
      },
    });

    await db
      .update(questionnaireResponses)
      .set({ tierClassification: tier, classifiedAt: now })
      .where(eq(questionnaireResponses.id, id));

    return Response.json({ completedAt: now.toISOString(), tier });
  }

  return Response.json({ completedAt: now.toISOString(), tier: null });
}
