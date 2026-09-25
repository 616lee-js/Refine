import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  APPEARANCE_COOKIE_OPTIONS,
  MODE_COOKIE,
  PALETTE_COOKIE,
  isMode,
  isPalette,
} from "@/lib/appearance";

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

  const parsed = body as {
    voiceCadence?: unknown;
    guidanceOpen?: unknown;
    palette?: unknown;
    mode?: unknown;
  };

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

  // Display choices. Rejected rather than coerced: an unrecognised value would
  // be written into a data-palette attribute, match no CSS block at all, and
  // look like the palette silently failing rather than like a bad request.
  if ("palette" in (parsed as object) && !isPalette(parsed.palette)) {
    return new Response("Invalid palette value", { status: 422 });
  }

  if ("mode" in (parsed as object) && !isMode(parsed.mode)) {
    return new Response("Invalid mode value", { status: 422 });
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
  if ("palette" in (parsed as object)) {
    merged.palette = parsed.palette;
  }
  if ("mode" in (parsed as object)) {
    merged.mode = parsed.mode;
  }

  await db
    .update(users)
    .set({ preferences: merged })
    .where(eq(users.id, authSession.userId));

  /*
   * The row is the truth; the cookies are how the root layout knows which
   * palette to paint without a database read on every request, including
   * signed-out ones. They carry nothing but which of three palettes someone
   * likes — see src/lib/appearance.ts.
   *
   * Set through cookies() rather than on a NextResponse, because this handler
   * returns a plain Response and a plain Response has no cookie jar — assigning
   * to one would have done nothing at all, quietly.
   */
  const jar = await cookies();
  if (isPalette(parsed.palette)) {
    jar.set(PALETTE_COOKIE, parsed.palette, APPEARANCE_COOKIE_OPTIONS);
  }
  if (isMode(parsed.mode)) {
    jar.set(MODE_COOKIE, parsed.mode, APPEARANCE_COOKIE_OPTIONS);
  }

  return Response.json({ preferences: merged });
}
