import type { LikertQuestionnaire } from "./types";

/**
 * PWI — Personal Wellbeing Index (Adult).
 *
 * International Wellbeing Group (2013). *Personal Wellbeing Index*, 5th edition.
 * Australian Centre on Quality of Life, Deakin University.
 * https://www.acqol.com.au/uploads/pwi-a/pwi-a-english.pdf
 *
 * ── What it measures, and why it is here ──────────────────────────────────────
 * Satisfaction with seven named areas of life rather than with life as a whole.
 * Chosen by the product owner over the SWLS, which asks one global question five
 * ways: "how satisfied are you with your life" and "which parts of my life are
 * working" are different questions, and the second is the one worth tracking.
 *
 * Descended from the Comprehensive Quality of Life Scale (ComQol). It is a
 * wellbeing measure, not a symptom screen — nothing here detects anything, which
 * is why no item carries `safetyItem`.
 *
 * ── Licence: free to use, and must never be sold ──────────────────────────────
 * The manual places no restriction on use for teaching, research or practice, on
 * the condition that the Index is **not sold**. Refine does not charge. **If it
 * ever does, this instrument has to come out** — that is a licence condition, not
 * a preference, and it is recorded in the known-limitations register as well as
 * here so it is not discovered later by whoever adds billing.
 *
 * ── Scored by averaging, not by adding ────────────────────────────────────────
 * `scoring: "mean-x10"`. The index is the mean of the seven, ×10, giving 0–100.
 * Summing would give 0–70 and the published bands would be meaningless against
 * it. This is the first instrument here that does not sum, which is why
 * `LikertQuestionnaire` gained the field rather than this file working around it.
 *
 * ── Wording unverified ────────────────────────────────────────────────────────
 * The item text below follows the published stem "How satisfied are you with…"
 * and the seven domain names, but has not been transcribed character-for-character
 * from the manual at the URL above. A validated instrument is validated at its
 * exact wording, so `wordingVerified` stays false and Mirror charts nothing for
 * it; answers are recorded regardless. Verify against that PDF in the same change
 * that flips the flag, and confirm the "not sold" condition still reads as above.
 *
 * ── The spirituality domain is deliberately absent ────────────────────────────
 * The International Wellbeing Group made Spiritual/Religious optional in April
 * 2013 and it is not part of the core seven. Left out rather than included: an
 * optional domain mixed into the core set changes what the published bands are
 * bands of. Adding it later must be a **new key**, never a re-use.
 *
 * ── No severity verdict on the answering screen ───────────────────────────────
 * Same rule as every other instrument here: `bands` exist so Mirror can give a
 * plain-language reading over time. "Not well" shown the instant someone finishes
 * answering is a verdict, and this product does not deliver verdicts.
 */
export const pwi: LikertQuestionnaire = {
  kind: "likert",
  slug: "pwi",
  version: "v1-2026-10-01-draft",

  // COPY REVIEW: ours, not the instrument's — title, blurb and cadence are how
  // the app frames it. The item text below is the instrument's and is not copy.
  title: "[COPY] Life satisfaction by area",
  shortName: "PWI",
  blurb:
    "[COPY] Seven areas of life, rated 0 to 10. A couple of minutes. There are no right answers.",
  cadence: "[COPY] Every 3 months",

  /**
   * The PWI asks about life as it is now rather than over a recall window, unlike
   * the two-week window GAD-7 and PHQ-9 carry. Stated rather than left blank,
   * since the answering screen prints this above the items.
   */
  recallWindow: "[COPY] Your life as it is now",

  /**
   * The ends of the scale, stated once. Required here because the options are
   * digits: a column headed "7" says nothing without knowing which end is which.
   */
  scaleAnchors: [
    "[COPY] 0 — no satisfaction at all",
    "[COPY] 10 — completely satisfied",
  ],

  allowsNote: true,
  shipped: true,

  // Not checked against the primary source, so Mirror charts nothing for it.
  // Flip to true in the same change that verifies the item text.
  wordingVerified: false,

  scoring: "mean-x10",

  /**
   * Eleven points, 0–10, as published. Labelled with the numbers themselves — the
   * scale's meaning is in `scaleAnchors`, not repeated eleven times.
   */
  options: [
    { value: 0, label: "0" },
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 5, label: "5" },
    { value: 6, label: "6" },
    { value: 7, label: "7" },
    { value: 8, label: "8" },
    { value: 9, label: "9" },
    { value: 10, label: "10" },
  ],

  /**
   * The seven core domains. **These keys are frozen the moment one response is
   * recorded** — see the instrument-keys section of CLAUDE.md. Wording above them
   * may change; these may not.
   */
  items: [
    { key: "standard_of_living", text: "How satisfied are you with your standard of living?" },
    { key: "health", text: "How satisfied are you with your health?" },
    {
      key: "achieving",
      text: "How satisfied are you with what you are achieving in life?",
    },
    {
      key: "relationships",
      text: "How satisfied are you with your personal relationships?",
    },
    { key: "safety", text: "How satisfied are you with how safe you feel?" },
    {
      key: "community",
      text: "How satisfied are you with feeling part of your community?",
    },
    {
      key: "future_security",
      text: "How satisfied are you with your future security?",
    },
  ],

  /**
   * The published normative ranges for the 0–100 index.
   *
   * `bandFor()` takes the highest band whose `min` the score reaches, so these are
   * floors rather than ranges: 69 is "under well", 70 begins "well". The Western
   * population average sits around 70–80, which is why the top band starts where
   * it does rather than at some high score.
   *
   * The labels are the manual's, not ours. They read oddly in isolation — "under
   * well" is not a phrase anyone says — which is exactly why they belong in
   * Mirror's reading over time rather than on the answering screen.
   */
  bands: [
    { min: 0, label: "not well" },
    { min: 50, label: "under well" },
    { min: 70, label: "well" },
  ],
};
