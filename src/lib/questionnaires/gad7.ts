import type { LikertQuestionnaire } from "./types";

/**
 * GAD-7 — Generalised Anxiety Disorder 7-item scale.
 *
 * ── VERIFY THE WORDING BEFORE ANYONE ELSE USES THIS ───────────────────────────
 * The item text below is the standard GAD-7 as commonly reproduced, but it was
 * written from knowledge rather than transcribed from an authoritative copy.
 * A validated instrument is validated *at its exact wording* — paraphrase and
 * the scores stop meaning what the literature says they mean. Check it against
 * a primary source (Spitzer, Kroenke, Williams & Löwe, 2006) before a tester
 * sees it, and bump `version` if anything changes.
 *
 * ── Licensing ─────────────────────────────────────────────────────────────────
 * GAD-7 is generally reproduced without a licence fee and without seeking
 * permission. That is the common understanding, not legal advice — confirm it
 * yourself, since this ships inside a product.
 *
 * ── No severity verdict on the questionnaire screen ───────────────────────────
 * `bands` exist so Mirror can give a plain-language reading over time. They are
 * deliberately not rendered at the moment of answering: a severity label
 * delivered the instant someone finishes is a diagnosis in all but name, and
 * this product does not diagnose.
 */
export const gad7: LikertQuestionnaire = {
  kind: "likert",
  slug: "gad7",
  version: "v1-2026-07-30",
  title: "Generalised anxiety",
  shortName: "GAD-7",
  recallWindow: "Over the last two weeks",
  blurb:
    "Seven questions. Under two minutes. Answer roughly — precision isn't the point.",
  cadence: "Every 2 weeks",
  allowsNote: true,
  shipped: true,

  // Not yet checked against a primary source, so Mirror charts nothing for
  // it. Flip to true in the same change that verifies the item text.
  wordingVerified: false,

  options: [
    { value: 0, label: "Not at all" },
    { value: 1, label: "Several days" },
    { value: 2, label: "Over half the days" },
    { value: 3, label: "Nearly every day" },
  ],

  items: [
    { key: "nervous", text: "Feeling nervous, anxious, or on edge" },
    { key: "control_worry", text: "Not being able to stop or control worrying" },
    { key: "worry_too_much", text: "Worrying too much about different things" },
    { key: "trouble_relaxing", text: "Trouble relaxing" },
    { key: "restless", text: "Being so restless that it's hard to sit still" },
    { key: "irritable", text: "Becoming easily annoyed or irritable" },
    {
      key: "afraid",
      text: "Feeling afraid as if something awful might happen",
    },
  ],

  // GAD-7 has no safety item — no question here is a disclosure of risk in
  // itself. PHQ-9 does, which is why that instrument is gated.
  bands: [
    { min: 0, label: "minimal" },
    { min: 5, label: "mild" },
    { min: 10, label: "moderate" },
    { min: 15, label: "severe" },
  ],
};
