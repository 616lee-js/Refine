import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  const [dbSession] = await db
    .select({ id: sessions.id, userId: sessions.userId, endedAt: sessions.endedAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!dbSession || dbSession.userId !== authSession.userId)
    return new Response("Not found", { status: 404 });

  if (dbSession.endedAt)
    return new Response("Session already ended", { status: 409 });

  // Hard-delete — cascades to check_ins, entries, safety_log, content_access_log
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  return new Response(null, { status: 204 });
}
