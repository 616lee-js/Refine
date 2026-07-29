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
  } catch (err) {
    // Fail loudly. This used to return EMPTY_PROFILE with HTTP 200, which is
    // indistinguishable from "this user has no profile" — so a wrong
    // ENCRYPTION_KEY rendered an empty form, and the next save overwrote real
    // encrypted PHI with blanks. Undecryptable data must never be presented as
    // absent data on a screen that can write back.
    console.error(
      `Profile decrypt failed for user ${authSession.userId}:`,
      err instanceof Error ? err.message : err
    );
    return new Response("Profile could not be read", { status: 500 });
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
    .select({ id: userProfiles.id, encryptedContent: userProfiles.encryptedContent })
    .from(userProfiles)
    .where(eq(userProfiles.userId, authSession.userId))
    .limit(1);

  // Refuse to overwrite content we cannot read. If the stored profile does not
  // decrypt, the cause is a key problem, not an empty profile — and overwriting
  // it destroys the only copy of that PHI. The GET above already 500s in this
  // case, so a well-behaved client never reaches here; this guards the direct
  // request and any future client that skips the read.
  if (existing?.encryptedContent) {
    try {
      decrypt(existing.encryptedContent);
    } catch (err) {
      console.error(
        `Refusing to overwrite undecryptable profile for user ${authSession.userId}:`,
        err instanceof Error ? err.message : err
      );
      return new Response("Existing profile could not be read; refusing to overwrite", {
        status: 500,
      });
    }
  }

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
