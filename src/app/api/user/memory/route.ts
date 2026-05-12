import { randomUUID } from "crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, authSession.userId), eq(userMemory.isActive, true)));

  const decoded = rows.map((r) => {
    let content = "";
    try { content = decrypt(r.encryptedContent); } catch { /* skip */ }
    return {
      id: r.id,
      kind: r.kind,
      source: r.source,
      content,
      confirmed: r.lastConfirmedAt !== null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  return Response.json(decoded);
}

export async function POST(req: Request) {
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }

  const { kind, content } = body as { kind?: unknown; content?: unknown };

  const VALID_KINDS = ["fact", "thread", "preference", "diagnostic_context", "other"];
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind)) {
    return new Response("Invalid kind", { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return new Response("Content required", { status: 400 });
  }

  const now = new Date();
  await db.insert(userMemory).values({
    id: randomUUID(),
    userId: authSession.userId,
    kind: kind as "fact" | "thread" | "preference" | "diagnostic_context" | "other",
    encryptedContent: encrypt(content.trim()),
    source: "user_added",
    reflectionId: null,
    isActive: true,
    lastConfirmedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return new Response(null, { status: 201 });
}
