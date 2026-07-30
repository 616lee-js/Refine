import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reflections, entries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { logSafetyClassification } from "@/lib/safety/classify-and-log";
import { runOrchestrator } from "@/lib/orchestrator";
import { persistAfterResponse } from "@/lib/after-response";

// Streaming an LLM response plus the post-response write can exceed Vercel's
// default function timeout (10s on Hobby). 60s is the Hobby ceiling and is
// comfortably above a 1024-token completion.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = body as {
    message?: unknown;
    reflectionId?: unknown;
    // Voice-only fields
    source?: unknown;
    precomputedTier?: unknown;
    audioRef?: unknown;
    voiceSummary?: unknown;
  };

  const message =
    typeof parsed.message === "string" ? parsed.message.trim() : "";
  const reflectionId =
    typeof parsed.reflectionId === "string" ? parsed.reflectionId.trim() : "";

  if (!message || !reflectionId) {
    return new Response("Bad request", { status: 400 });
  }

  const source =
    parsed.source === "user_voice" ? "user_voice" : "user_text";

  const precomputedTier =
    typeof parsed.precomputedTier === "number" &&
    [0, 1, 2, 3].includes(parsed.precomputedTier)
      ? (parsed.precomputedTier as 0 | 1 | 2 | 3)
      : undefined;

  const audioRef =
    typeof parsed.audioRef === "string" ? parsed.audioRef : undefined;

  // voiceSummary: { triggerType, utteranceTiers, maxTier }
  const voiceSummary =
    source === "user_voice" &&
    parsed.voiceSummary &&
    typeof parsed.voiceSummary === "object"
      ? (parsed.voiceSummary as {
          triggerType: string;
          utteranceTiers: number[];
          maxTier: number;
        })
      : null;

  // Verify reflection belongs to this user
  const [dbReflection] = await db
    .select({ id: reflections.id, userId: reflections.userId })
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);

  if (!dbReflection || dbReflection.userId !== session.userId) {
    return new Response("Not found", { status: 404 });
  }

  const { stream, tier, entryId } = await runOrchestrator({
    reflectionId,
    userId: session.userId,
    message,
    source,
    precomputedTier,
    audioRef,
  });

  const encoder = new TextEncoder();
  let assistantText = "";

  // Registered here, in the request context — after() cannot be called from
  // inside the stream callbacks below.
  const persist = persistAfterResponse("chat: save assistant entry");

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        assistantText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      stream.on("finalMessage", () => {
        controller.close();

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

          if (voiceSummary) {
            // Already classified per utterance as the user spoke; this row is
            // the summary against the real entryId. No reclassification.
            await logSafetyClassification({
              reflectionId,
              entryId,
              tier,
              rawSignals: {
                source: "voice_response",
                triggerType: voiceSummary.triggerType,
                utteranceTiers: voiceSummary.utteranceTiers,
                maxTier: voiceSummary.maxTier,
              },
            });
          }
        });
      });

      stream.on("error", (err) => {
        controller.error(err);
        // Partial text is discarded, as before — nothing to persist.
        persist.abort();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Tier": String(tier),
    },
  });
}
