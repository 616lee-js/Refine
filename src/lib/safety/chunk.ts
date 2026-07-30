/**
 * Text chunking for safety classification. Pure — no database, no network, no
 * env. Kept in its own module so the logic the entire safety net depends on can
 * be tested without standing up a database connection.
 *
 * ── Why chunk at all ──────────────────────────────────────────────────────────
 * The tier classifier is built for single short messages: its prompt header says
 * "current message only" and every worked example is one sentence. Handing it a
 * 600-word entry invites it to judge the overall tone and miss one acute
 * sentence in the fourth paragraph.
 *
 * This is the same dilution problem the voice paradigm was designed around.
 * Phase 4 classifies each spoken utterance separately and takes the running max
 * precisely because whole-articulation classification "would dilute embedded
 * Tier 2/3 signals". A long written entry has the identical failure mode, so it
 * gets the identical treatment rather than a new prompt.
 *
 * Paragraph breaks are the natural unit: they are where a writer changes
 * subject, and they need no sentence tokenizer.
 */

/**
 * Splits text into classification chunks on blank lines.
 *
 * A blank line means one or more newlines separated only by whitespace, so
 * `\r\n\r\n` and `\n   \n` both count. A single newline does NOT split — writers
 * use those inside a thought, and splitting on them would fragment sentences
 * into meaningless pieces.
 *
 * Returns `[]` for empty or whitespace-only input, so callers can distinguish
 * "nothing to classify" from "classified as tier 0".
 */
export function chunkForClassification(text: string): string[] {
  return text
    .split(/\r?\n[ \t]*(?:\r?\n[ \t]*)+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}
