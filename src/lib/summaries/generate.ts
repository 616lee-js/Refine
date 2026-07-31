import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";
import { promptVersion } from "@/lib/safety/prompt-version";

// Bundled at build time, not read from disk — see next.config.ts for why a
// runtime readFileSync of a prompt cannot survive the serverless bundler.
import summariserPrompt from "@/lib/layer2/entry-summariser.md";

import type { EntrySummary } from "./types";
import { parse, SummaryGenerationError } from "./parse";

export { SummaryGenerationError };

/**
 * Recorded against every summary row. Derived from the prompt's own header, so
 * editing the prompt makes old and new summaries distinguishable without anyone
 * remembering to bump a literal.
 */
export const SUMMARISER_VERSION = promptVersion(summariserPrompt);

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Entries are human-written and bounded in practice, but a paste is not. Cap the
 * input so one pathological entry cannot run up an unbounded bill, and say so in
 * the prompt rather than truncating silently.
 */
const MAX_INPUT_CHARS = 40_000;

/**
 * Summarises one entry body.
 *
 * Throws rather than returning a degraded result: the caller records a failed
 * attempt and the entry is retried on the next run. A placeholder summary
 * written into Cabinet 2 would be indistinguishable from a real one later, and
 * everything downstream would treat a parse failure as something the person said.
 */
export async function generateSummary(body: string): Promise<EntrySummary> {
  const trimmed = body.trim();
  if (!trimmed) throw new SummaryGenerationError("Entry is empty");

  const truncated = trimmed.length > MAX_INPUT_CHARS;
  const input = truncated ? trimmed.slice(0, MAX_INPUT_CHARS) : trimmed;

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: summariserPrompt,
    messages: [
      {
        role: "user",
        content: truncated
          ? `[This entry was truncated for length; summarise only what follows.]\n\n${input}`
          : input,
      },
    ],
  });

  const raw =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return parse(raw, body);
}
