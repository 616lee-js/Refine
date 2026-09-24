import type { LikertQuestionnaire } from "./types";

/**
 * SWLS — Satisfaction With Life Scale.
 *
 * Diener, E., Emmons, R. A., Larsen, R. J., & Griffin, S. (1985). The
 * Satisfaction With Life Scale. *Journal of Personality Assessment*, 49, 71–75.
 *
 * ── What it measures, and what it does not ────────────────────────────────────
 * A global judgement of life satisfaction — how someone rates their life against
 * their own standards, not against anyone else's. It is a wellbeing measure, not
 * a symptom screen: unlike GAD-7 and PHQ-9 there is no clinical threshold here
 * and nothing to detect. That is why it carries no `safetyItem`.
 *
 * ── The scale runs 1–7, not 0–3 ───────────────────────────────────────────────
 * The first instrument here whose options do not start at zero, which has two
 * consequences worth knowing:
 *
 *   1. The total floor is 5, not 0. A fully-answered "extremely dissatisfied"
 *      response scores 5 — it is not the same as an empty one.
 *   2. Because `score()` sums only the items actually answered, a partly
 *      answered response lands low and reads as dissatisfaction rather than as
 *      incomplete. Harmless while `wordingVerified` is false, since bands
 *      surface only in Mirror's trends and those do not render for an unverified
 *      instrument — but it must be handled before that flag flips.
 *
 * ── Wording and licensing unverified ──────────────────────────────────────────
 * The item text below was written from knowledge rather than transcribed from an
 * authoritative copy. A validated instrument is validated at its exact wording,
 * so `wordingVerified` stays false and Mirror charts nothing for it; answers are
 * recorded regardless. The SWLS is generally described as free to use without
 * permission, which is the common understanding and not legal advice — confirm
 * it, and verify the wording against the 1985 paper, in the same change that
 * flips the flag.
 *
 * ── No severity verdict on the answering screen ───────────────────────────────
 * Same rule as the other instruments: `bands` exist so Mirror can give a
 * plain-language reading over time, and are deliberately not shown at the moment
 * of answering. Telling someone they are "dissatisfied" the instant they finish
 * is a verdict, and this product does not deliver verdicts.
 */
export const swls: LikertQuestionnaire = {
  kind: "likert",
  slug: "swls",
  version: "v1-2026-09-24-draft",

  // COPY REVIEW: ours, not the instrument's — title, blurb and cadence are how
  // the app frames it. The item text below is the instrument's and is not copy.
  title: "[COPY] Life satisfaction",
  shortName: "SWLS",
  blurb: "[COPY] Five statements. Under a minute. There are no right answers.",
  cadence: "[COPY] Every few months",

  /**
   * The SWLS asks about life in general rather than a recall window, unlike the
   * two-week window GAD-7 and PHQ-9 carry. Stated rather than left blank, since
   * the answering screen prints this above the items.
   */
  recallWindow: "[COPY] Your life in general",

  allowsNote: true,
  shipped: true,

  // Not checked against a primary source, so Mirror charts nothing for it.
  // Flip to true in the same change that verifies the item text.
  wordingVerified: false,

  /**
   * Seven points, agreement rather than frequency. Valued 1–7 as published —
   * the scoring bands below are defined against that range and would be
   * meaningless rescaled to 0–6.
   */
  options: [
    { value: 1, label: "Strongly disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Slightly disagree" },
    { value: 4, label: "Neither agree nor disagree" },
    { value: 5, label: "Slightly agree" },
    { value: 6, label: "Agree" },
    { value: 7, label: "Strongly agree" },
  ],

  items: [
    { key: "ideal", text: "In most ways my life is close to my ideal." },
    { key: "conditions", text: "The conditions of my life are excellent." },
    { key: "satisfied", text: "I am satisfied with my life." },
    {
      key: "important_things",
      text: "So far I have gotten the important things I want in life.",
    },
    {
      key: "change_nothing",
      text: "If I could live my life over, I would change almost nothing.",
    },
  ],

  /**
   * Diener's published cutoffs for the 5–35 total.
   *
   * `bandFor()` takes the highest band whose `min` the total reaches, so these
   * are floors rather than ranges: 20 exactly is "neutral", 21 begins "slightly
   * satisfied".
   */
  bands: [
    { min: 5, label: "extremely dissatisfied" },
    { min: 10, label: "dissatisfied" },
    { min: 15, label: "slightly dissatisfied" },
    { min: 20, label: "neutral" },
    { min: 21, label: "slightly satisfied" },
    { min: 26, label: "satisfied" },
    { min: 31, label: "extremely satisfied" },
  ],
};
