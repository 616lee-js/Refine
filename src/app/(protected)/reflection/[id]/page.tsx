import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, users } from "@/lib/db/schema";
import Chat from "../../chat";

export default async function ReflectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [reflection] = await db
    .select({ id: reflections.id, userId: reflections.userId, endedAt: reflections.endedAt })
    .from(reflections)
    .where(eq(reflections.id, id))
    .limit(1);

  if (!reflection || reflection.userId !== authSession.userId) notFound();

  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .limit(1);

  const prefs =
    user?.preferences && typeof user.preferences === "object"
      ? (user.preferences as Record<string, unknown>)
      : {};

  const VALID_CADENCES = new Set([0, 10, 20, 30]);
  const initialCadence = VALID_CADENCES.has(prefs.voiceCadence as number)
    ? (prefs.voiceCadence as 0 | 10 | 20 | 30)
    : 10;

  return (
    <Chat
      reflectionId={id}
      initialCadence={initialCadence}
      initialEnded={!!reflection.endedAt}
    />
  );
}
