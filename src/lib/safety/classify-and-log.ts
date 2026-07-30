import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { safetyLog } from "@/lib/db/schema";
import { classifyMessage, CLASSIFIER_VERSION, type Tier } from "./classifier";
import { chunkForClassification } from "./chunk";

/**
 * Safety classification, separated from the conversational orchestrator.
 *
 * Open journal entries have no AI response, so they must not go anywhere near
 * `runOrchestrator` — but they must still be classified and logged. This module
 * is the single implementation both paths use, so the chat path and the journal
 * path cannot drift apart. When the framework check-in workflow arrives it
 * inherits the same behaviour by calling the same function.
 *
 * Nothing here writes journal content. `safety_log` holds a tier, a prompt
 * version, and signal metadata — never text.
 */

/**
 * What produced a classification. Stored in `safety_log.source`.
 *
 * `questionnaire` matters specially: it means a scored safety item (such as
 * PHQ-9 item 9) triggered this, not something the user wrote in their own words.
 * Those rows warrant a different response path and are worth filtering on when
 * reviewing the log.
 */
export type SafetySource =
  | "journal_entry"
  | "journal_edit"
  | "questionnaire";

export type ClassificationResult = {
  /** Highest tier found across all chunks. */
  tier: Tier;
  /** Per-chunk tiers, in order. Recorded in safety_log for calibration review. */
  chunkTiers: Tier[];
};

/**
 * Classifies text by taking the highest tier across its paragraphs.
 *
 * Chunks are classified concurrently — they are independent, and a long entry
 * would otherwise serialise a dozen Haiku round-trips while the user waits to
 * see whether resources appear.
 */
export async function classifyText(text: string): Promise<ClassificationResult> {
  const chunks = chunkForClassification(text);

  if (chunks.length === 0) {
    return { tier: 0, chunkTiers: [] };
  }

  const chunkTiers = await Promise.all(chunks.map((c) => classifyMessage(c)));
  const tier = chunkTiers.reduce<Tier>((max, t) => (t > max ? t : max), 0);

  return { tier, chunkTiers };
}

/**
 * Writes one safety_log row for an already-determined tier.
 *
 * Kept separate from classifyText so the voice path — which classifies
 * per-utterance as the user speaks and already knows its max — can log without
 * reclassifying.
 */
export async function logSafetyClassification({
  userId,
  journalEntryId = null,
  questionnaireResponseId = null,
  source,
  tier,
  rawSignals = {},
}: {
  userId: string;
  journalEntryId?: string | null;
  questionnaireResponseId?: string | null;
  source: SafetySource;
  tier: Tier;
  rawSignals?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(safetyLog).values({
    id: randomUUID(),
    userId,
    journalEntryId,
    questionnaireResponseId,
    source,
    tier,
    classifierVersion: CLASSIFIER_VERSION,
    rawSignals,
  });
}

/**
 * Classify text and write the safety_log row in one step. Returns the tier so
 * the caller can decide whether to surface crisis resources.
 */
export async function classifyAndLog({
  userId,
  journalEntryId = null,
  questionnaireResponseId = null,
  text,
  source,
}: {
  userId: string;
  journalEntryId?: string | null;
  questionnaireResponseId?: string | null;
  text: string;
  source: SafetySource;
}): Promise<Tier> {
  const { tier, chunkTiers } = await classifyText(text);

  await logSafetyClassification({
    userId,
    journalEntryId,
    questionnaireResponseId,
    source,
    tier,
    rawSignals: {
      chunkCount: chunkTiers.length,
      // Only meaningful when the text was actually split; a single-chunk entry
      // adds nothing beyond `tier`.
      ...(chunkTiers.length > 1 ? { chunkTiers } : {}),
    },
  });

  return tier;
}
