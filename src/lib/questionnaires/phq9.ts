import type { LikertQuestionnaire } from "./types";

/**
 * PHQ-9 — Patient Health Questionnaire, 9 items.
 *
 * ── NOT SHIPPED. `shipped: false` keeps it out of the product. ────────────────
 * This is structure, not a live instrument, and it must stay that way until two
 * things are settled by the product owner:
 *
 *   1. **Item 9's response path.** "Thoughts that you would be better off dead,
 *      or of hurting yourself in some way" is not a symptom rating — it is a
 *      disclosure of risk, answered by tapping a radio button. It routes through
 *      safety_log with source "questionnaire", which records it, but recording
 *      is not responding. What the person sees after answering it above zero is
 *      a content decision belonging with the Tier 2/3 pass. Until that exists,
 *      shipping this instrument means collecting a risk disclosure and showing
 *      the person nothing.
 *
 *   2. **Wording and licensing.** As with GAD-7, the text below was written from
 *      knowledge rather than transcribed from an authoritative copy, and a
 *      validated instrument is validated at its exact wording. Verify against a
 *      primary source (Kroenke, Spitzer & Williams, 2001) before use.
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

  /** Gated. See the note above — do not flip without the item 9 response path. */
  shipped: false,

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
