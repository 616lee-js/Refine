import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  const [row] = await db
    .select({ id: userMemory.id, userId: userMemory.userId })
    .from(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, authSession.userId)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }

  const { action, content } = body as { action?: unknown; content?: unknown };
  const now = new Date();

  if (action === "confirm") {
    await db
      .update(userMemory)
      .set({ lastConfirmedAt: now, updatedAt: now })
      .where(eq(userMemory.id, id));
    return new Response(null, { status: 204 });
  }

  if (typeof content === "string" && content.trim()) {
    await db
      .update(userMemory)
      .set({
        encryptedContent: encrypt(content.trim()),
        lastConfirmedAt: now,
        updatedAt: now,
      })
      .where(eq(userMemory.id, id));
    return new Response(null, { status: 204 });
  }

  return new Response("Bad request", { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  await db
    .delete(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, authSession.userId)));

  return new Response(null, { status: 204 });
}
