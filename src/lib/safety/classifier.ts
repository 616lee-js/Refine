import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";

// Bundled at build time, not read from disk. See next.config.ts.
import classifierPrompt from "@/lib/layer3/tier-classifier-prompt.md";
import { promptVersion } from "./prompt-version";
import { replyText } from "@/lib/model-reply";

/**
 * Recorded against every safety_log row. Derived from the classifier prompt's
 * own header rather than hardcoded, so edits to the prompt are traceable in the
 * log without anyone remembering to bump a literal.
 */
export const CLASSIFIER_VERSION = promptVersion(classifierPrompt);

export type Tier = 0 | 1 | 2 | 3;

const TIER_MAP: Record<string, Tier> = {
  tier0: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
};

export async function classifyMessage(message: string): Promise<Tier> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    system: classifierPrompt,
    messages: [{ role: "user", content: message }],
  });

  // Not content[0]: a reply can lead with a thinking block and the text is not
  // guaranteed to be first. Here that would have meant every entry silently
  // classified as Tier 1 by the fallback below. See src/lib/model-reply.ts.
  const raw = replyText(response).trim();

  try {
    const parsed = JSON.parse(raw) as { tier?: string };
    const key = parsed.tier ?? "";
    if (key in TIER_MAP) return TIER_MAP[key];
  } catch {
    // fall through
  }

  // Fail safe: Tier 1 is safer than Tier 0 on parse failure
  return 1;
}
