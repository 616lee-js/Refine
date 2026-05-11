import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response(null, { status: 204 });

  const [dbSession] = await db
    .select({ id: sessions.id, userId: sessions.userId, endedAt: sessions.endedAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!dbSession || dbSession.userId !== authSession.userId)
    return new Response(null, { status: 204 });
  if (dbSession.endedAt)
    return new Response(null, { status: 204 });

  const [{ userEntryCount }] = await db
    .select({ userEntryCount: sql<number>`COUNT(*)::int` })
    .from(entries)
    .where(and(eq(entries.sessionId, sessionId), ne(entries.source, "claude")));

  if (userEntryCount === 0) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  } else {
    await db
      .update(sessions)
      .set({ endedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)));
  }

  return new Response(null, { status: 204 });
}
