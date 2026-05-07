import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { asc, eq, sql } from "drizzle-orm";
import { getAnthropicApiKey } from "@/lib/env";
import { db } from "@/lib/db";
import { entries, safetyLog } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { classifyMessage, type Tier } from "./classifier";
import { buildSystemPrompt } from "./context";

export type { Tier };

export async function runOrchestrator({
  sessionId,
  message,
}: {
  sessionId: string;
  message: string;
}) {
  // 1. Classify
  const tier = await classifyMessage(message);

  // 2. Next sequence number for this session
  const [{ maxSeq }] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${entries.sequence}), 0)` })
    .from(entries)
    .where(eq(entries.sessionId, sessionId));
  const userSequence = maxSeq + 1;

  // 3. Save user entry
  const entryId = randomUUID();
  await db.insert(entries).values({
    id: entryId,
    sessionId,
    sequence: userSequence,
    source: "user_text",
    encryptedContent: encrypt(message),
    tierClassification: tier,
  });

  // 4. Log to safety_log
  await db.insert(safetyLog).values({
    id: randomUUID(),
    sessionId,
    entryId,
    tier,
    classifierVersion: "v1",
    rawSignals: {},
  });

  // 5. Fetch session history (includes the entry we just saved)
  const sessionEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.sessionId, sessionId))
    .orderBy(asc(entries.sequence));

  const messages: Array<{ role: "user" | "assistant"; content: string }> =
    sessionEntries.map((e) => ({
      role: e.source === "claude" ? "assistant" : "user",
      content: decrypt(e.encryptedContent),
    }));

  // 6. Build system prompt with tier-appropriate Layer 3 fragments
  const systemPrompt = buildSystemPrompt(tier);

  // 7. Start stream
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  return { stream, tier };
}
