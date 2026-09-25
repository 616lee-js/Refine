# Layer 2 — Mirror Report
# Version: UNWRITTEN
# Sent to: claude-sonnet-5 (one call per person, fortnightly)
#
# THIS PROMPT HAS NOT BEEN WRITTEN.
#
# The file exists so the code around it compiles and can be reviewed. It holds
# no instructions, and `src/lib/mirror/review.ts` refuses to run while this
# header reads UNWRITTEN. A report about a real person, worded by nobody, is
# worse than no report.
#
# Per CLAUDE.md rule 7, Layer 2 content is worked through with the product
# owner rather than drafted here. The gate is `docs/refine_test_prompts.md`;
# whether those cases apply to a report rather than a conversation is itself an
# open question, and additions are proposed, not added.
#
# ── What the code around this already fixes ───────────────────────────────────
#
# Input, in this order: what they have told Refine about themselves (profile),
# what they have confirmed in their Mirror, summaries of everything written,
# entries since the last report in full, the check-in figures, and what previous
# reports said.
#
# Output: JSON, `{ "report": string, "periodNote": string }`. `report` is the
# running whole-picture account, rewritten each run. `periodNote` is short and
# covers this window only; it is what the history is made of.
#
# ── Open, and NOT decided here ────────────────────────────────────────────────
#
#   1. What the report is for and what it may claim. Its failure mode is saying
#      something wrong about a person, in prose they read about themselves.
#
#   2. Hedging, and when it relaxes. The product owner's instruction
#      (2026-09-24): Mirror may say a pattern seems SIMILAR TO ones indicating a
#      condition, and may hedge less where the person has already declared that
#      condition themselves. Unresolved: what counts as having declared it. The
#      profile is three free-text boxes, so reading a declaration out of prose is
#      the model's judgement, and being wrong means an unhedged clinical
#      statement to someone who declared nothing. A confirmed Mirror entry of
#      kind `diagnostic_context` is the firmer signal. Owner's call.
#
#   3. **Numbers must not be restated.** Check-in figures are appended to the
#      report verbatim, as the exact strings Trends shows on its charts, and
#      Trends deliberately allows no model-written prose about them. Nothing in
#      the code can stop this prompt paraphrasing a figure — only this file can.
#      Whatever else it says, it has to say that.
#
#   4. What belongs in `periodNote` versus the running report, given the note is
#      permanent history and the report is replaced every run.
#
#   5. Length.
#
# When it is written, replace the header with a real version line
# (e.g. `# Version: v1 — 2026-10-01`). That alone switches reports on, and the
# change gets an entry in `docs/prompt-changelog.md`.
