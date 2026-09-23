# Refine — Prompt Changelog

Track changes to Layer 2 (system prompt) and Layer 3 (reference fragments) here. One entry per meaningful edit. Edit this file directly in your editor or on GitHub.

---

## Pending — drafted, not applied

Entries below are written when a change actually lands, so these are pointers only.

- **`entry-summariser.md` v2** — categories become general buckets rather than the
  writer's specific phrasing; quotes guidance still to be drafted into the same
  bump. Full diff and consequences in `docs/build-notes.md`. Deferred to the copy
  review; applying it reflows the whole archive at 25/day.
- **`tier-classifier-prompt.md`** — a per-row signal category (which signal fired,
  not just which tier) for the safety log. Closed vocabulary owed as a proposal.

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
