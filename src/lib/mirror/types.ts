/**
 * What one run of Mirror's report produces.
 *
 * Two pieces of writing from one call: the running account of everything so
 * far, and a short account of this window alone. Mirror shows the newest
 * report; the history is every window's note, read back in order.
 */
export type RawReport = {
  /** The running whole-picture report. Rewritten every run. */
  report: string;
  /** What changed in this window alone. Short. */
  periodNote: string;
};

/**
 * Sentences about check-in numbers, taken verbatim from what Trends already
 * displays.
 *
 * ── Why these are not written by the model ────────────────────────────────────
 * Trends refuses to let a model write prose about someone's mental-health
 * scores, and that line does not move for the report. These come from
 * `buildTrends()`, so a number in the report and the same number on the chart
 * cannot disagree — they are the same string.
 *
 * ── The honest limit ──────────────────────────────────────────────────────────
 * The model is shown these so it knows what the numbers are. Nothing in the
 * code can stop it restating one in its own words; only its instructions can.
 * That constraint belongs in the instructions file and is called out there.
 */
export type CheckinLines = string[];
