import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import Chat from "../../chat";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!session || session.userId !== authSession.userId) notFound();

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

  return <Chat sessionId={id} initialCadence={initialCadence} />;
}
