import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reflectionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  const [dbReflection] = await db
    .select({ id: reflections.id, userId: reflections.userId, endedAt: reflections.endedAt })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== authSession.userId)
    return new Response("Not found", { status: 404 });

  if (dbReflection.endedAt)
    return new Response("Reflection already ended", { status: 409 });

  // Hard-delete — cascades to check_ins, entries, safety_log, content_access_log
  await db.delete(reflections).where(eq(reflections.id, reflectionId));

  return new Response(null, { status: 204 });
}
