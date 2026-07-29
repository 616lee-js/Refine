import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { getAnthropicApiKey } from "@/lib/env";
import { db } from "@/lib/db";
import { entries, safetyLog } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { classifyMessage, CLASSIFIER_VERSION, type Tier } from "./classifier";
import {
  buildSystemPrompt,
  buildLayer4Context,
  logPromptComposition,
} from "./context";

export type { Tier };

export async function runOrchestrator({
  reflectionId,
  userId,
  message,
  source = "user_text",
  precomputedTier,
  audioRef,
}: {
  reflectionId: string;
  userId: string;
  message: string;
  source?: "user_text" | "user_voice";
  precomputedTier?: 0 | 1 | 2 | 3;
  audioRef?: string;
}) {
  // 1. Classify (skip if caller already classified)
  const tier: Tier = precomputedTier ?? (await classifyMessage(message));

  // 2. Next sequence number for this reflection
  const [{ maxSeq }] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${entries.sequence}), 0)` })
    .from(entries)
    .where(eq(entries.reflectionId, reflectionId));
  const userSequence = maxSeq + 1;

  // 3. Save user entry
  const entryId = randomUUID();
  await db.insert(entries).values({
    id: entryId,
    reflectionId,
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
      reflectionId,
      entryId,
      tier,
      classifierVersion: CLASSIFIER_VERSION,
      rawSignals: {},
    });
  }

  // 5. Fetch reflection history (includes the entry we just saved)
  const reflectionEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.reflectionId, reflectionId))
    .orderBy(asc(entries.sequence));

  const messages: Array<{ role: "user" | "assistant"; content: string }> =
    reflectionEntries.map((e) => ({
      role: e.source === "claude" ? "assistant" : "user",
      content: decrypt(e.encryptedContent),
    }));

  // 6. Build system prompt with tier-appropriate Layer 3 + Layer 4 context
  const layer4 = await buildLayer4Context(userId);
  const composed = buildSystemPrompt(tier, layer4.text);

  logPromptComposition({
    call: "reflection",
    reflectionId,
    tier,
    composed,
    layer4,
    historyEntries: messages.length,
  });

  // 7. Start stream
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: composed.prompt,
    messages,
  });

  return { stream, tier, entryId };
}

const REFLECTION_CLOSING_INSTRUCTION = `
---

## Reflection Closing

The user has indicated they are ready to end this reflection. Provide a warm, contextually appropriate closing response that draws on what has been shared in this conversation. Keep it brief. The tone and safety boundaries of this closing must remain consistent with the tier context already active — if elevated safety concerns were present, maintain the open-door, continued-presence language through the close.`;

/**
 * Runs the full orchestrator pipeline for a reflection-closing response.
 * Uses the last user entry's recorded tier rather than re-classifying.
 * Does not create a user entry or safety log row — the close is system-initiated.
 * The Claude response is saved as a 'claude' entry by the caller after streaming.
 */
export async function runReflectionClosing(reflectionId: string, userId: string) {
  // Look up the tier of the last user message in this reflection
  const [lastUserEntry] = await db
    .select({ tier: entries.tierClassification })
    .from(entries)
    .where(and(eq(entries.reflectionId, reflectionId), ne(entries.source, "claude")))
    .orderBy(desc(entries.sequence))
    .limit(1);

  const tier: Tier = (lastUserEntry?.tier as Tier) ?? 0;

  // Fetch full reflection history for context
  const reflectionEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.reflectionId, reflectionId))
    .orderBy(asc(entries.sequence));

  const messages: Array<{ role: "user" | "assistant"; content: string }> =
    reflectionEntries.map((e) => ({
      role: e.source === "claude" ? "assistant" : "user",
      content: decrypt(e.encryptedContent),
    }));

  const layer4 = await buildLayer4Context(userId);
  const composed = buildSystemPrompt(tier, layer4.text);

  logPromptComposition({
    call: "closing",
    reflectionId,
    tier,
    composed,
    layer4,
    historyEntries: messages.length,
  });

  // Anthropic requires ≥1 message and last message must be from `user`.
  messages.push({ role: "user", content: "I'm ready to wrap up." });

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: composed.prompt + REFLECTION_CLOSING_INSTRUCTION,
    messages,
  });

  return { stream, tier };
}
