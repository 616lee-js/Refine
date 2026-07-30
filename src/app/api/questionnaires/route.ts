import { randomUUID } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionnaireResponses } from "@/lib/db/schema";
import { getStartableQuestionnaire } from "@/lib/questionnaires";

/**
 * Starts (or resumes) a questionnaire response.
 *
 * Resuming rather than always creating is what makes "Finish later" work: an
 * unfinished response is one with `completed_at` NULL, and returning to the
 * instrument picks it back up instead of stranding partial answers.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const { slug } = body as { slug?: unknown };
  if (typeof slug !== "string") {
    return Response.json({ error: "slug required" }, { status: 400 });
  }

  // getStartableQuestionnaire, not getQuestionnaire: the shipped gate is
  // enforced in the registry so a route cannot serve a gated instrument by
  // forgetting to check. PHQ-9 is gated until its item 9 response path exists.
  const q = getStartableQuestionnaire(slug);
  if (!q) {
    return Response.json({ error: "unknown_or_unavailable" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: questionnaireResponses.id })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, session.userId),
        eq(questionnaireResponses.questionnaireSlug, slug),
        isNull(questionnaireResponses.completedAt),
        isNull(questionnaireResponses.deletedAt)
      )
    )
    .orderBy(desc(questionnaireResponses.createdAt))
    .limit(1);

  if (existing) {
    return Response.json({ responseId: existing.id, resumed: true });
  }

  const id = randomUUID();
  await db.insert(questionnaireResponses).values({
    id,
    userId: session.userId,
    questionnaireSlug: q.slug,
    questionnaireVersion: q.version,
  });

  return Response.json({ responseId: id, resumed: false });
}
