import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { getAnthropicApiKey } from "@/lib/env";

export type Tier = 0 | 1 | 2 | 3;

const TIER_MAP: Record<string, Tier> = {
  tier0: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
};

const classifierPrompt = readFileSync(
  join(process.cwd(), "src/lib/layer3/tier-classifier-prompt.md"),
  "utf-8"
);

export async function classifyMessage(message: string): Promise<Tier> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    system: classifierPrompt,
    messages: [{ role: "user", content: message }],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

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
