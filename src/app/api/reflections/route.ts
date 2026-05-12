import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, checkIns } from "@/lib/db/schema";

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

  const parsed = body as {
    type?: string;
    checkin?: {
      presentText?: string;
      mood?: { rating: number };
      intentionText?: string;
    };
  };

  const { type, checkin = {} } = parsed;

  if (type !== "as_needed" && type !== "scheduled") {
    return Response.json({ error: "not_implemented" }, { status: 403 });
  }

  const reflectionId = randomUUID();

  await db.insert(reflections).values({
    id: reflectionId,
    userId: session.userId,
    type,
    modality: "text",
  });

  await db.insert(checkIns).values({
    id: randomUUID(),
    reflectionId,
    mood: checkin.mood ?? {},
    presentText: checkin.presentText ?? null,
    intentionText: checkin.intentionText ?? null,
  });

  return Response.json({ reflectionId });
}
