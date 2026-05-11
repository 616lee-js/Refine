import { randomUUID } from "crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions, entries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { runSessionClosing } from "@/lib/orchestrator";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const authSession = await getSession();
  if (!authSession.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [dbSession] = await db
    .select({ id: sessions.id, userId: sessions.userId, endedAt: sessions.endedAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!dbSession || dbSession.userId !== authSession.userId) {
    return new Response("Not found", { status: 404 });
  }

  if (dbSession.endedAt) {
    return new Response("Session already ended", { status: 409 });
  }

  // Discard sessions with no user input — delete and return 204 (no closing message)
  const [{ userEntryCount }] = await db
    .select({ userEntryCount: sql<number>`COUNT(*)::int` })
    .from(entries)
    .where(and(eq(entries.sessionId, sessionId), ne(entries.source, "claude")));

  if (userEntryCount === 0) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return new Response(null, { status: 204 });
  }

  let closingResult: Awaited<ReturnType<typeof runSessionClosing>>;
  try {
    closingResult = await runSessionClosing(sessionId, authSession.userId);
  } catch (err) {
    console.error("runSessionClosing failed:", err);
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
        // Save closing response + mark session ended — fire and forget
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
          .then(() =>
            db
              .update(sessions)
              .set({ endedAt: new Date() })
              .where(eq(sessions.id, sessionId))
          )
          .catch((err) => console.error("Failed to close session:", err));
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
