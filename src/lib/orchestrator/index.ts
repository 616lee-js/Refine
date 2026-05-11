import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { getAnthropicApiKey } from "@/lib/env";
import { db } from "@/lib/db";
import { entries, safetyLog } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { classifyMessage, type Tier } from "./classifier";
import { buildSystemPrompt, buildLayer4Context } from "./context";

export type { Tier };

export async function runOrchestrator({
  sessionId,
  userId,
  message,
  source = "user_text",
  precomputedTier,
  audioRef,
}: {
  sessionId: string;
  userId: string;
  message: string;
  source?: "user_text" | "user_voice";
  precomputedTier?: 0 | 1 | 2 | 3;
  audioRef?: string;
}) {
  // 1. Classify (skip if caller already classified)
  const tier: Tier = precomputedTier ?? (await classifyMessage(message));

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
    source,
    encryptedContent: encrypt(message),
    rawAudioRef: audioRef ?? null,
    tierClassification: tier,
  });

  // 4. Log to safety_log (skipped for voice — per-utterance rows already saved;
  //    caller saves the summary row with the real entryId after stream completes)
  if (source !== "user_voice") {
    await db.insert(safetyLog).values({
      id: randomUUID(),
      sessionId,
      entryId,
      tier,
      classifierVersion: "v1",
      rawSignals: {},
    });
  }

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

  // 6. Build system prompt with tier-appropriate Layer 3 + Layer 4 context
  const layer4 = await buildLayer4Context(userId);
  const systemPrompt = buildSystemPrompt(tier, layer4);

  // 7. Start stream
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  return { stream, tier, entryId };
}

const SESSION_CLOSING_INSTRUCTION = `
---

## Session Closing

The user has indicated they are ready to end this session. Provide a warm, contextually appropriate closing response that draws on what has been shared in this conversation. Keep it brief. The tone and safety boundaries of this closing must remain consistent with the tier context already active — if elevated safety concerns were present, maintain the open-door, continued-presence language through the close.`;

/**
 * Runs the full orchestrator pipeline for a session-closing response.
 * Uses the last user entry's recorded tier rather than re-classifying.
 * Does not create a user entry or safety log row — the close is system-initiated.
 * The Claude response is saved as a 'claude' entry by the caller after streaming.
 */
export async function runSessionClosing(sessionId: string, userId: string) {
  // Look up the tier of the last user message in this session
  const [lastUserEntry] = await db
    .select({ tier: entries.tierClassification })
    .from(entries)
    .where(and(eq(entries.sessionId, sessionId), ne(entries.source, "claude")))
    .orderBy(desc(entries.sequence))
    .limit(1);

  const tier: Tier = (lastUserEntry?.tier as Tier) ?? 0;

  // Fetch full session history for context
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

  const layer4 = await buildLayer4Context(userId);
  const systemPrompt = buildSystemPrompt(tier, layer4) + SESSION_CLOSING_INSTRUCTION;

  // Anthropic requires ≥1 message and last message must be from `user`.
  messages.push({ role: "user", content: "I'm ready to wrap up." });

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });

  return { stream, tier };
}
