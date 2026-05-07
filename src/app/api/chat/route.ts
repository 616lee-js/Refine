import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries } from "@/lib/db/schema";
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

  const message =
    body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message).trim()
      : "";

  if (!message) {
    return new Response("Bad request", { status: 400 });
  }

  // Get or create an active (non-ended) session
  const existing = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, session.userId!))
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  let sessionId: string;

  if (existing.length > 0) {
    sessionId = existing[0].id;
  } else {
    sessionId = randomUUID();
    await db.insert(sessions).values({
      id: sessionId,
      userId: session.userId!,
      type: "as_needed",
      modality: "text",
    });
  }

  const { stream, tier } = await runOrchestrator({
    sessionId,
    message,
  });

  // Pipe Anthropic text events into a plain-text ReadableStream for the client.
  // Collect full assistant text in parallel for DB save after stream closes.
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
        // Fire and forget — save assistant entry after response is closed
        db
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
          )
          .catch((err) => console.error("Failed to save assistant entry:", err));
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
