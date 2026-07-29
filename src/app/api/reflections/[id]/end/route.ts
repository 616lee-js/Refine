import { randomUUID } from "crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { runReflectionClosing } from "@/lib/orchestrator";
import { persistAfterResponse } from "@/lib/after-response";

// See the note in /api/chat — streaming plus the post-response write can exceed
// the default 10s Hobby timeout.
export const maxDuration = 60;

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

  const { stream, tier } = closingResult;
  const encoder = new TextEncoder();
  let assistantText = "";

  // Registered here, in the request context — after() cannot be called from
  // inside the stream callbacks below.
  const persist = persistAfterResponse("end: save closing entry + mark ended");

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        assistantText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      stream.on("finalMessage", () => {
        controller.close();

        // Save closing response, then mark the reflection ended. Held open by
        // after() — previously fire-and-forget, which meant a reflection could
        // intermittently stay open with its closing message lost.
        persist.run(async () => {
          const [{ maxSeq }] = await db
            .select({ maxSeq: sql<number>`COALESCE(MAX(${entries.sequence}), 0)` })
            .from(entries)
            .where(eq(entries.reflectionId, reflectionId));

          await db.insert(entries).values({
            id: randomUUID(),
            reflectionId,
            sequence: maxSeq + 1,
            source: "claude",
            encryptedContent: encrypt(assistantText),
            tierClassification: null,
          });

          await db
            .update(reflections)
            .set({ endedAt: new Date() })
            .where(eq(reflections.id, reflectionId));
        });
      });

      stream.on("error", (err) => {
        controller.error(err);
        persist.abort();
      });
    },
  });

  // X-Tier carries the tier the closing response was generated under — the tier
  // of the last user message, not a re-classification. The client renders the
  // crisis resource panel from this. Without it, a reflection ending at Tier 2/3
  // would show no resources at all on its final message.
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Tier": String(tier),
    },
  });
}
