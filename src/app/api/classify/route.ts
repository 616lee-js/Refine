import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, safetyLog } from "@/lib/db/schema";
import { classifyMessage } from "@/lib/orchestrator/classifier";

export async function POST(req: Request) {
  const authSession = await getSession();
  if (!authSession.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = body as {
    reflectionId?: unknown;
    text?: unknown;
    utteranceIndex?: unknown;
  };

  const reflectionId =
    typeof parsed.reflectionId === "string" ? parsed.reflectionId.trim() : "";
  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
  const utteranceIndex =
    typeof parsed.utteranceIndex === "number" ? parsed.utteranceIndex : 0;

  if (!reflectionId || !text) {
    return new Response("Bad request", { status: 400 });
  }

  const [dbReflection] = await db
    .select({ id: reflections.id, userId: reflections.userId })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== authSession.userId) {
    return new Response("Not found", { status: 404 });
  }

  const tier = await classifyMessage(text);

  await db.insert(safetyLog).values({
    id: randomUUID(),
    reflectionId,
    entryId: null,
    tier,
    classifierVersion: "v1",
    rawSignals: { source: "utterance", index: utteranceIndex },
  });

  return Response.json({ tier });
}
