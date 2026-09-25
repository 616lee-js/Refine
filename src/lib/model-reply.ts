import type Anthropic from "@anthropic-ai/sdk";

/**
 * The text of a model reply.
 *
 * ── Why this is not `content[0]` ──────────────────────────────────────────────
 * A reply is a LIST of blocks and the text is not guaranteed to be the first
 * one. Claude Sonnet 5 returns a `thinking` block ahead of its `text` block, so
 * reading index zero yields an empty string and every caller then fails on
 * whatever it tried to do with it.
 *
 * That is exactly how Mirror's report shipped broken on 2026-09-25: each run
 * read the thinking block, got "", and threw "Report reply was not JSON". The
 * call had succeeded. Nothing was wrong with the prompt, the model, or the key.
 *
 * The failure mode is worth naming because it is silent in the wrong direction —
 * the API call costs money and returns a perfectly good answer, and the code
 * throws it away before looking at it.
 *
 * ── Every block, joined ───────────────────────────────────────────────────────
 * All text blocks are concatenated rather than the first one taken, because a
 * reply split across two text blocks is legal and taking one would truncate it
 * without any error to notice.
 */
export function replyText(
  response: Anthropic.Messages.Message
): string {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
