import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Voice is archived; the value is still accepted so an existing stored
// preference round-trips rather than being rejected.
const VOICE_CADENCE_VALUES = new Set([0, 10, 20, 30]);

export async function PATCH(req: Request) {
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

  const parsed = body as { voiceCadence?: unknown; guidanceOpen?: unknown };

  if (
    "voiceCadence" in (parsed as object) &&
    !VOICE_CADENCE_VALUES.has(parsed.voiceCadence as number)
  ) {
    return new Response("Invalid voiceCadence value", { status: 422 });
  }

  if (
    "guidanceOpen" in (parsed as object) &&
    typeof parsed.guidanceOpen !== "boolean"
  ) {
    return new Response("Invalid guidanceOpen value", { status: 422 });
  }

  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .limit(1);

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const existing =
    user.preferences && typeof user.preferences === "object"
      ? (user.preferences as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = { ...existing };
  if ("voiceCadence" in (parsed as object)) {
    merged.voiceCadence = parsed.voiceCadence;
  }
  if ("guidanceOpen" in (parsed as object)) {
    merged.guidanceOpen = parsed.guidanceOpen;
  }

  await db
    .update(users)
    .set({ preferences: merged })
    .where(eq(users.id, authSession.userId));

  return Response.json({ preferences: merged });
}
