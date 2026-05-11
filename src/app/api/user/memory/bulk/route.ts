import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";

export async function DELETE(req: Request) {
  const authSession = await getSession();
  if (!authSession.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }

  const { kind } = body as { kind?: unknown };

  const VALID_KINDS = ["fact", "thread", "preference", "diagnostic_context", "other"];

  if (kind !== undefined) {
    if (typeof kind !== "string" || !VALID_KINDS.includes(kind)) {
      return new Response("Invalid kind", { status: 400 });
    }
    await db
      .delete(userMemory)
      .where(
        and(
          eq(userMemory.userId, authSession.userId),
          eq(userMemory.kind, kind as "fact" | "thread" | "preference" | "diagnostic_context" | "other")
        )
      );
  } else {
    await db
      .delete(userMemory)
      .where(eq(userMemory.userId, authSession.userId));
  }

  return new Response(null, { status: 204 });
}
