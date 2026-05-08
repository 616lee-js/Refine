import { and, eq, isNull, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, safetyLog } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [dbSession] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!dbSession || dbSession.userId !== authSession.userId) {
    return new Response("Not found", { status: 404 });
  }

  await db
    .delete(safetyLog)
    .where(
      and(
        eq(safetyLog.sessionId, sessionId),
        isNull(safetyLog.entryId),
        sql`${safetyLog.rawSignals}->>'source' = 'utterance'`
      )
    );

  return new Response(null, { status: 204 });
}
