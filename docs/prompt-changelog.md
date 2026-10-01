# Refine — Prompt Changelog

Track changes to Layer 2 (system prompt) and Layer 3 (reference fragments) here. One entry per meaningful edit. Edit this file directly in your editor or on GitHub.

---

## Pending — drafted, not applied

Entries below are written when a change actually lands, so these are pointers only.

- **`entry-summariser.md` — quotes guidance.** Held by the product owner until
  there is summary evaluation data to judge it against. Not drafted.
- **`tier-classifier-prompt.md`** — a per-row signal category (which signal fired,
  not just which tier) for the safety log. Closed vocabulary owed as a proposal.
- **`memory-extraction.md` — two open items**, both marked proposed rather than
  agreed in the file itself: report length, and what a report does when
  difficulty has run for a long time. The second is a safety decision and has
  never been drafted.

---

## `memory-extraction.md` v2 — 2026-10-01

**The window and the entry count are now given to the model.** v1 asked it to say
how many entries a pattern appeared in and over what span, while the software sent
it neither — so it tallied the blocks of text in its own context. That is how the
first real report said "twelve entries" when the stored count was ten. The one
authoritative figure, `entriesRead`, never left the server and appeared only in
the line above the report.

The window start, window end and entry count now arrive at the top of the message,
marked as given and not to be recounted — the same treatment the check-in figures
already had.

**Each section now says how far back it reaches**, because they do not all reach
the same distance: summaries and check-in figures are all-time, only the full entry
text is limited to the window. Unlabelled, a figure drawn from a year of check-ins
invited being described as recent.

**The current window leads.** The report remains the running account of everything
written — the product owner's decision, so continuity is kept — but what happened
in this window is what it is for, opens the report, and gets the most room. The
longer history is context behind it, not the subject.

The two counts are now distinguished: how much the report covers is given and must
never be recounted; how many entries a particular pattern appears in is the model's
own observation and must name what was counted ("in four of the entries this
fortnight"), because a bare number cannot be checked by the person reading it.

Also in this change, outside the prompt: the `[COPY]` draft markers that were
appearing at the bottom of every report are stripped where the check-in lines are
built. They are screen copy awaiting review, and the marker was travelling into
the report text and into the prompt. The wording itself is still unreviewed.

---

## `entry-summariser.md` v3 — 2026-10-01

**The summary length ceiling is removed.** Reported by the product owner: a long
entry produced a summary that stopped partway through.

Two separate limits were doing it, and lifting either alone would have moved the
cut rather than removed it:

- The prompt said *"Never more than about 70 words"*. Replaced with length that
  follows the entry — no limit, no target.
- The code cut the result at 600 characters with a bare `slice()`, mid-word, with
  nothing logged and nothing raised. Removed. `max_tokens` raised 700 → 2000 as
  the remaining outer stop, which fails loudly because a reply cut mid-JSON does
  not parse and the entry is retried.

**The same 600-character cut was also applied to the writer's own corrections** on
save, so a long correction was silently shortened and the save looked successful.
That path now refuses an over-long correction with a reason instead of truncating
it, matching how an over-long quote was already handled in the same route.

"Do not pad" is unchanged and now carries the whole load — it is the only thing
holding length down.

**Also corrected in v3: a statement that had been false for two months.** The
prompt told the model *"your prose summary is never shown to them"*, and its
header said *"nothing here is shown as prose to the user"*. Both were copied from
the v1 spec (*"Nothing from Cabinet 2 is surfaced to the user in v1"*) on
2026-07-30. On 2026-08-04, five days later, `407ec75` shipped the read-back panel
and the correction route — the summary became visible and editable — and the
prompt was never revisited.

So the model was being told to write for a machine-only audience while the writer
was in fact reading its prose and correcting it. The product owner confirmed the
intent was always that the summary be visible and correctable: it aggregates
entries for Mirror, and there was never a reason to withhold it.

The opening now states both audiences and that everything is correctable, while
keeping the third-person past-tense register — being read is not the same as being
addressed, and that register is what keeps a summary a record rather than a letter.
*"No one reads this for support"* became an accurate version of the same rule.

`docs/refine_v1_planning.md` lines 139 and 457 are struck through and dated.
`docs/refine_testing_cadence.md:47` carries the same stale claim and was left
alone, per the standing instruction not to modify that file unasked.

**Consequence:** every stored summary became due and is rewritten at 25/day.
Writers' own corrections are untouched; only the AI's version is replaced.

---

## `memory-extraction.md` v1 — 2026-09-25

**First version of the Mirror report instructions.** Shipped live rather than
drafted — the version line in the file is what switches reports on.

- The declared-condition rule: only "I have X", "I was diagnosed with X" or "my X"
  count as a declaration. "I feel X" and "maybe I'm X" do not. Ambiguous cases
  hedge.
- The duration rule: say how long a pattern has run, never predict that it
  continues. Length of time is itself the thing worth naming.
- Written with the product owner, per working rule 7.

Two items in it are explicitly marked proposed rather than agreed — see Pending.

---

## `entry-summariser.md` v2 — 2026-09-24

**Categories become a fixed, enforced vocabulary** rather than the writer's own
phrasing. The list is interpolated from `src/lib/summaries/categories.ts` at call
time, and its fingerprint is folded into the stored version, so editing the list
re-versions every summary too.

Previously recorded in this file as pending. It shipped in `5f16500`; the entry
was never moved. Full diff and consequences in `docs/build-notes.md`.

---

## v1 — 2026-05-06

Initial versions of all prompt files. Clinical review required before v2.

**Layer 2**
- `src/lib/layer2/system-prompt.md` — core system prompt (mirror-and-guide, PACE, four-tier safety model)

**Layer 3**
- `src/lib/layer3/mi-overview.md` — Motivational Interviewing reference (PACE, OARS, ambivalence)
- `src/lib/layer3/tier-1-protocol.md` — Tier 1 (elevated distress) response guidance
- `src/lib/layer3/tier-2-protocol.md` — Tier 2 (concerning indicators) response guidance
- `src/lib/layer3/tier-3-protocol.md` — Tier 3 (acute risk) response guidance
- `src/lib/layer3/crisis-resources.md` — US crisis resource list (988, Crisis Text Line, SAMHSA, warmlines, therapy directories)
