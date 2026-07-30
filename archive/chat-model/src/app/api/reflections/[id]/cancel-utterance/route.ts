import { and, eq, isNull, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, safetyLog } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reflectionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [dbReflection] = await db
    .select({ id: reflections.id, userId: reflections.userId })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== authSession.userId) {
    return new Response("Not found", { status: 404 });
  }

  await db
    .delete(safetyLog)
    .where(
      and(
        eq(safetyLog.reflectionId, reflectionId),
        isNull(safetyLog.entryId),
        sql`${safetyLog.rawSignals}->>'source' = 'utterance'`
      )
    );

  return new Response(null, { status: 204 });
}
