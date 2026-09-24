import type { LikertQuestionnaire } from "./types";

/**
 * PHQ-9 — Patient Health Questionnaire, 9 items.
 *
 * ── Shipped 2026-09-24 ────────────────────────────────────────────────────────
 * This was gated on one thing: item 9 ("thoughts that you would be better off
 * dead, or of hurting yourself in some way") is not a symptom rating but a
 * disclosure of risk, answered by tapping a radio button. Shipping it meant
 * recording that and showing the person nothing.
 *
 * That is now the intended behaviour rather than a gap. Refine is an isolated
 * entry and reflection log; it does not carry escalation paths to external
 * services, and it is not screening anyone. Item 9 keeps `safetyItem: true`, so
 * answering it above zero still writes a `safety_log` row with source
 * "questionnaire" — that log exists to verify the classifier and the safety
 * plumbing work, not to surveil.
 *
 * **If the escalation stance changes, this instrument is where it lands first.**
 * Adding a response surface after item 9 is a deliberate decision, not a tidy-up.
 *
 * ── Wording and licensing are still unverified ────────────────────────────────
 * As with GAD-7, the text below was written from knowledge rather than
 * transcribed from an authoritative copy, and a validated instrument is
 * validated at its exact wording. `wordingVerified` stays false, which is what
 * keeps Mirror from charting it — answers are recorded either way. Verify
 * against a primary source (Kroenke, Spitzer & Williams, 2001) and flip the flag
 * in the same change.
 *
 * The tenth PHQ-9 question — the functional-impairment item — is deliberately
 * absent: it is not scored in the 0–27 total and needs its own presentation.
 */
export const phq9: LikertQuestionnaire = {
  kind: "likert",
  slug: "phq9",
  version: "v1-2026-07-30-draft",
  title: "Low mood",
  shortName: "PHQ-9",
  recallWindow: "Over the last two weeks",
  blurb:
    "Nine questions. Under two minutes. Answer roughly — precision isn't the point.",
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
    { key: "anhedonia", text: "Little interest or pleasure in doing things" },
    { key: "depressed", text: "Feeling down, depressed, or hopeless" },
    {
      key: "sleep",
      text: "Trouble falling or staying asleep, or sleeping too much",
    },
    { key: "energy", text: "Feeling tired or having little energy" },
    { key: "appetite", text: "Poor appetite or overeating" },
    {
      key: "self_worth",
      text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    },
    {
      key: "concentration",
      text: "Trouble concentrating on things, such as reading the newspaper or watching television",
    },
    {
      key: "psychomotor",
      text: "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
    },
    {
      key: "self_harm",
      text: "Thoughts that you would be better off dead, or of hurting yourself in some way",
      safetyItem: true,
    },
  ],

  bands: [
    { min: 0, label: "minimal" },
    { min: 5, label: "mild" },
    { min: 10, label: "moderate" },
    { min: 15, label: "moderately severe" },
    { min: 20, label: "severe" },
  ],
};
