import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries, safetyLog } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { runOrchestrator } from "@/lib/orchestrator";

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
    sessionId?: unknown;
    // Voice-only fields
    source?: unknown;
    precomputedTier?: unknown;
    audioRef?: unknown;
    voiceSummary?: unknown;
  };

  const message =
    typeof parsed.message === "string" ? parsed.message.trim() : "";
  const sessionId =
    typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : "";

  if (!message || !sessionId) {
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

  // Verify session belongs to this user
  const [dbSession] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!dbSession || dbSession.userId !== session.userId) {
    return new Response("Not found", { status: 404 });
  }

  const { stream, tier, entryId } = await runOrchestrator({
    sessionId,
    userId: session.userId,
    message,
    source,
    precomputedTier,
    audioRef,
  });

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

        const saveAssistant = db
          .select({ maxSeq: sql<number>`COALESCE(MAX(${entries.sequence}), 0)` })
          .from(entries)
          .where(eq(entries.sessionId, sessionId))
          .then(([{ maxSeq }]) =>
            db.insert(entries).values({
              id: randomUUID(),
              sessionId,
              sequence: maxSeq + 1,
              source: "claude",
              encryptedContent: encrypt(assistantText),
              tierClassification: null,
            })
          );

        const saveVoiceSafetyLog = voiceSummary
          ? saveAssistant.then(() =>
              db.insert(safetyLog).values({
                id: randomUUID(),
                sessionId,
                entryId,
                tier,
                classifierVersion: "v1",
                rawSignals: {
                  source: "voice_response",
                  triggerType: voiceSummary.triggerType,
                  utteranceTiers: voiceSummary.utteranceTiers,
                  maxTier: voiceSummary.maxTier,
                },
              })
            )
          : saveAssistant;

        saveVoiceSafetyLog.catch((err) =>
          console.error("Failed to save assistant entry:", err)
        );
      });

      stream.on("error", (err) => {
        controller.error(err);
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
