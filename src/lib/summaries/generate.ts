import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";
import { promptVersion } from "@/lib/safety/prompt-version";
import { replyText } from "@/lib/model-reply";

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
 *
 * From v2 to v3 a fingerprint of the fixed category list was folded in here, so
 * that editing the list re-versioned every summary. The list was retired on
 * 2026-11-12 — categories are the person's own now — so the prompt is the whole
 * of what the model is told, and its header is the whole of the version.
 */
export const SUMMARISER_VERSION = promptVersion(summariserPrompt);

const SYSTEM_PROMPT = summariserPrompt;

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
    /*
     * Was 700, which was the real ceiling on a summary once the 600-character
     * clip was removed — lifting one without the other just moves the cut.
     *
     * 2000 covers the longest entry this can be given (MAX_INPUT_CHARS of source
     * at the prompt's "follow the entry" ratio) plus the categories, people and
     * quotes in the same reply. It is a safety stop, not a target: the prompt is
     * what decides length, and hitting this fails loudly because a reply cut
     * mid-JSON does not parse and the entry is retried.
     */
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: truncated
          ? `[This entry was truncated for length; summarise only what follows.]\n\n${input}`
          : input,
      },
    ],
  });

  // Not content[0]: a reply can lead with a thinking block and the text is not
  // guaranteed to be first. See src/lib/model-reply.ts.
  return parse(replyText(response), body);
}
