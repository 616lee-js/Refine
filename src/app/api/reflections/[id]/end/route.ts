import { randomUUID } from "crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { runReflectionClosing } from "@/lib/orchestrator";

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
    .select({ id: reflections.id, userId: reflections.userId, endedAt: reflections.endedAt })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== authSession.userId) {
    return new Response("Not found", { status: 404 });
  }

  if (dbReflection.endedAt) {
    return new Response("Reflection already ended", { status: 409 });
  }

  // Discard reflections with no user input — delete and return 204 (no closing message)
  const [{ userEntryCount }] = await db
    .select({ userEntryCount: sql<number>`COUNT(*)::int` })
    .from(entries)
    .where(and(eq(entries.reflectionId, reflectionId), ne(entries.source, "claude")));

  if (userEntryCount === 0) {
    await db.delete(reflections).where(eq(reflections.id, reflectionId));
    return new Response(null, { status: 204 });
  }

  let closingResult: Awaited<ReturnType<typeof runReflectionClosing>>;
  try {
    closingResult = await runReflectionClosing(reflectionId, authSession.userId);
  } catch (err) {
    console.error("runReflectionClosing failed:", err);
    return new Response("Internal server error", { status: 500 });
  }

  const { stream } = closingResult;
  const encoder = new TextEncoder();
  let assistantText = "";

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        assistantText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      stream.on("finalMessage", () => {
        controller.close();
        // Save closing response + mark reflection ended — fire and forget
        db
          .select({ maxSeq: sql<number>`COALESCE(MAX(${entries.sequence}), 0)` })
          .from(entries)
          .where(eq(entries.reflectionId, reflectionId))
          .then(([{ maxSeq }]) =>
            db.insert(entries).values({
              id: randomUUID(),
              reflectionId,
              sequence: maxSeq + 1,
              source: "claude",
              encryptedContent: encrypt(assistantText),
              tierClassification: null,
            })
          )
          .then(() =>
            db
              .update(reflections)
              .set({ endedAt: new Date() })
              .where(eq(reflections.id, reflectionId))
          )
          .catch((err) => console.error("Failed to close reflection:", err));
      });

      stream.on("error", (err) => {
        controller.error(err);
      });
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
