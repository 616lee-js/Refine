import type { TrackerQuestionnaire } from "./types";

/**
 * The daily check-in.
 *
 * Not a clinical instrument — no validation to preserve, no licence, no bands.
 * It exists to make trends possible with four taps, and its wording is ours to
 * change freely, unlike GAD-7's.
 *
 * ── Deliberately unscored ─────────────────────────────────────────────────────
 * There is no total. Adding hours slept to a mood rating produces a number that
 * looks like a measurement and isn't. Mirror reads the individual fields.
 *
 * ── No streaks, ever ──────────────────────────────────────────────────────────
 * A missed day costs nothing and is never mentioned. The habit toggles are a
 * record of what happened, not a score to keep up — which is why they are
 * neutral verbs rather than goals, and why nothing here congratulates.
 * `guidance.ts` states this as a product rule; it applies here most of all,
 * because a daily surface is exactly where streak mechanics creep in.
 */
export const dailyCheckin: TrackerQuestionnaire = {
  kind: "tracker",
  slug: "daily_checkin",
  /*
   * v2: the `kept_up` field was relabelled. Bumped so a stored response records
   * which wording was actually on screen when it was answered — the keys and the
   * values are unchanged, so nothing about the data moves.
   */
  version: "v2-2026-10-09",
  title: "Daily check-in",
  shortName: "Check-in",
  blurb: "Four taps. Then write, or don't.",
  allowsNote: false,
  shipped: true,

  fields: [
    {
      kind: "count",
      key: "sleep_hours",
      label: "Slept",
      note: "Hours, roughly",
      min: 0,
      max: 14,
      step: 0.5,
      unit: "h",
    },
    {
      kind: "scale",
      key: "mood",
      label: "Mood",
      note: "Now, not the whole day",
      steps: 5,
      endLabels: ["Low", "Even", "Good"],
    },
    {
      kind: "scale",
      key: "energy",
      label: "Energy",
      note: "Now, not the whole day",
      steps: 5,
      endLabels: ["Empty", "Fine", "Full"],
    },
    {
      kind: "toggles",
      key: "kept_up",
      /*
       * "Kept up" until 2026-10-09, which disagreed with two of its own options.
       *
       * It reads as "things I maintained", which is right for medication, moved
       * and outside and backwards for alcohol and screens — the product owner
       * asked whether tapping "Screens after 11" meant screens were used or
       * avoided, which is exactly the ambiguity. It records that they *were*.
       *
       * The key stays `kept_up` and so do `alcohol` and `late_screens`. Check-in
       * answers are stored against keys, not labels, and renaming one does not
       * error — historical answers simply stop being found. See the
       * instrument-keys section of CLAUDE.md, which names this specific field as
       * the outstanding case and prescribes relabelling as the fix.
       */
      label: "What happened",
      note: "Tap anything that did",
      options: [
        { key: "medication", label: "Medication" },
        { key: "moved", label: "Moved" },
        { key: "outside", label: "Outside" },
        { key: "alcohol", label: "Alcohol" },
        { key: "late_screens", label: "Screens after 11" },
      ],
    },
  ],
};
