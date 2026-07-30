import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionnaireResponses } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import {
  getQuestionnaire,
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

/** Accepts only keys the instrument defines, and only values it offers. */
function sanitiseAnswers(
  slug: string,
  raw: unknown
): Record<string, number> | null {
  const q = getQuestionnaire(slug);
  if (!q || typeof raw !== "object" || raw === null) return null;

  const allowedValues = new Set(q.options.map((o) => o.value));
  const out: Record<string, number> = {};

  for (const item of q.items) {
    const v = (raw as Record<string, unknown>)[item.key];
    if (typeof v === "number" && allowedValues.has(v)) {
      out[item.key] = v;
    }
  }
  return out;
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

  const { answers, note } = body as { answers?: unknown; note?: unknown };
  const clean = sanitiseAnswers(row.questionnaireSlug, answers);
  if (!clean) return new Response("Invalid answers", { status: 400 });

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
  const clean = sanitiseAnswers(row.questionnaireSlug, answers);
  if (!clean) return new Response("Invalid answers", { status: 400 });

  // No required-field blocking: a partly-answered instrument still records.
  // Scoring a partial total is honest as long as the raw items travel with it,
  // which they do.
  const scoring = score(q, clean);
  const now = new Date();

  await db
    .update(questionnaireResponses)
    .set({
      encryptedAnswers: encrypt(
        JSON.stringify({ answers: clean, note: typeof note === "string" ? note : "" })
      ),
      encryptedScoring: encrypt(JSON.stringify(scoring)),
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
   * Recording is not responding. What the person SEES after such an answer is a
   * content decision that has not been made, which is exactly why PHQ-9 is
   * gated at the registry and cannot be started. This branch is here so the
   * mechanism is in place and tested when that decision lands — it does not run
   * for GAD-7, which has no safety item.
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
