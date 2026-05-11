import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";

type ProfileShape = {
  tendencies: string;
  goals: string;
  background: string;
};

const EMPTY_PROFILE: ProfileShape = { tendencies: "", goals: "", background: "" };

export async function GET() {
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  const [row] = await db
    .select({ encryptedContent: userProfiles.encryptedContent })
    .from(userProfiles)
    .where(eq(userProfiles.userId, authSession.userId))
    .limit(1);

  if (!row?.encryptedContent) return Response.json(EMPTY_PROFILE);

  try {
    const profile = JSON.parse(decrypt(row.encryptedContent)) as ProfileShape;
    return Response.json({ ...EMPTY_PROFILE, ...profile });
  } catch {
    return Response.json(EMPTY_PROFILE);
  }
}

export async function PUT(req: Request) {
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }

  const { tendencies = "", goals = "", background = "" } = body as Partial<ProfileShape>;
  const profile: ProfileShape = {
    tendencies: String(tendencies).trim(),
    goals: String(goals).trim(),
    background: String(background).trim(),
  };

  const encryptedContent = encrypt(JSON.stringify(profile));
  const now = new Date();

  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, authSession.userId))
    .limit(1);

  if (existing) {
    await db
      .update(userProfiles)
      .set({ encryptedContent, updatedAt: now })
      .where(eq(userProfiles.userId, authSession.userId));
  } else {
    await db.insert(userProfiles).values({
      id: randomUUID(),
      userId: authSession.userId,
      encryptedContent,
      createdAt: now,
      updatedAt: now,
    });
  }

  return new Response(null, { status: 204 });
}
