import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reflectionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response(null, { status: 204 });

  const [dbReflection] = await db
    .select({ id: reflections.id, userId: reflections.userId, endedAt: reflections.endedAt })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== authSession.userId)
    return new Response(null, { status: 204 });
  if (dbReflection.endedAt)
    return new Response(null, { status: 204 });

  const [{ userEntryCount }] = await db
    .select({ userEntryCount: sql<number>`COUNT(*)::int` })
    .from(entries)
    .where(and(eq(entries.reflectionId, reflectionId), ne(entries.source, "claude")));

  if (userEntryCount === 0) {
    await db.delete(reflections).where(eq(reflections.id, reflectionId));
  } else {
    await db
      .update(reflections)
      .set({ endedAt: new Date() })
      .where(and(eq(reflections.id, reflectionId), isNull(reflections.endedAt)));
  }

  return new Response(null, { status: 204 });
}
