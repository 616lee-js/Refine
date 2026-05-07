# Refine — Test Personas

A living document for synthetic test personas used to evaluate the app's behavior across different user types. Maintained over the course of the build; populated and refined as the build progresses.

These personas are not for use until v1 is functionally complete (after Phase 7). They start being journaled-as during the v1 self-testing period in parallel with your real journaling, building up corpora for v1.5 longitudinal feature design and evaluation.

---

## Why personas matter

The longitudinal feature can only be designed and tested against accumulated journaling data. Your own real data is the truth-source, but it's one data shape — your topics, your language, your patterns. Personas extend the testable surface area.

**Two purposes:**

*Signal extraction testing.* Personas with deliberately constructed inner lives, including hidden patterns, test whether the system can find what's actually there. Can the synthesis layer notice the pattern you intentionally embedded?

*Negative testing.* Personas with no coherent pattern — random topics, varied moods, no underlying through-line — test whether the system manufactures patterns from noise. The system should be willing to say "nothing strong has emerged" when nothing has. This is the most-skipped, most-important evaluation mode.

---

## Persona design principles

**Realistic noise matters.** A persona that journals only about its theme is a horoscope generator's dream. Real people journal about their cat, a podcast they liked, a weird interaction at lunch, the weather, things that don't fit any theme. Personas need to do the same. Synthetic-sounding personas produce synthetic-sounding evaluations.

**Vary mood unpredictably.** Real users don't have consistent mood arcs. Bad days come for no reason; good days too. Personas should reflect this rather than tracking a clean emotional trajectory.

**Skip days.** Real users don't journal every day. Personas shouldn't either.

**Vary length and depth.** Some entries should be short check-ins ("tired, work was long, going to sleep"). Others should be longer reflections. Mixing is realistic.

**Don't always explicitly name what you're processing.** Real users circle around things, mention them obliquely, talk about something else when actually thinking about a different thing. Personas should do this too.

**Mix modalities.** Voice and text both, since the app supports both. Voice transcripts have different texture than typed entries — false starts, filler words, longer rambles.

---

## Personas

Each persona has a name, a brief profile, the hidden pattern (if any), and notes on how to journal as them. Personas are added incrementally — start with two or three at the beginning of the v1 self-testing period and add more as needed.

---

### Persona template

Use this template when adding a new persona below.

```
NAME: [pseudonym]

PROFILE
- Age range:
- Life situation (work, relationships, location — broad strokes):
- Reason they would use the app:
- General disposition:
- Communication style:

HIDDEN PATTERN (if any)
- The underlying pattern this persona is intended to test for. Could be a transdiagnostic factor (rumination, avoidance, self-criticism), a behavioral pattern (sleep-anxiety connection, weekend-low-mood pattern), or a relational dynamic (guarded language about a specific person).
- Or: NO HIDDEN PATTERN — this persona is for negative testing.

JOURNALING NOTES
- Frequency to aim for:
- Modality preference (voice/text/mixed):
- Topics this persona naturally goes to:
- Topics this persona naturally avoids:
- Realistic noise to include (mundane stuff, off-theme entries):
- Things to NOT do (over-coherence to avoid):
```

---

### To start (drafts — refine before activation)

The personas below are starting drafts. Refine them before journaling-as begins.

#### Persona 1 — for transdiagnostic pattern testing

```
NAME: TBD

PROFILE
- Age range: 30s
- Life situation: Knowledge worker, partnered, no kids
- Reason for using: Something feels off and they want to understand it; not in therapy currently
- General disposition: High-functioning, articulate, internally critical
- Communication style: Reflective, moderate length, prefers text

HIDDEN PATTERN
- Self-criticism is the underlying transdiagnostic factor
- Shows up in entries about work (perfectionism), relationships (always feeling at fault), creative pursuits (never starting because it won't be good)
- Surface concerns vary; underlying language pattern is consistent

JOURNALING NOTES
- 3-5 sessions per week
- Mostly text; voice occasionally
- Topics: work projects, partner dynamics, abandoned creative ideas, sleep
- Avoid: family of origin (deflects to other topics)
- Realistic noise: weekend trips, podcasts, mundane logistics, occasional good days
- DON'T: write entries that explicitly name "I'm being self-critical" — the pattern is in the language, not in self-awareness
```

#### Persona 2 — for negative testing (no coherent pattern)

```
NAME: TBD

PROFILE
- Age range: 40s
- Life situation: Solo, mid-career, recently moved cities
- Reason for using: Curious about journaling, no specific issue
- General disposition: Generally even-keeled, varied interests
- Communication style: Mixed length, mixed modality

HIDDEN PATTERN
- NO HIDDEN PATTERN — explicitly designed to have no through-line
- Topics jump around; mood varies without correlation; no recurring concerns

JOURNALING NOTES
- 2-4 sessions per week, irregular
- Mix of voice and text
- Topics: hobbies, work (varied), social interactions, current events occasionally, dreams, food, books
- Vary mood randomly across entries
- DON'T: develop any consistent theme. If a theme starts to emerge, deliberately break it in the next session
- This persona's success criterion: when the longitudinal feature runs against this corpus, it should NOT manufacture insights
```

#### Persona 3 — for life-transition pattern testing (placeholder)

To be developed later, before transition-related longitudinal patterns become a focus.

#### Persona 4 — for relational pattern testing (placeholder)

To be developed later, before relational longitudinal patterns become a focus.

---

## Maintenance notes

- **Don't activate personas before Phase 7 is complete.** They're useless without a working v1 to journal in.
- **Track which sessions are persona-generated.** A simple flag in the session metadata, or a separate test account if multi-account is built before v2. You need to be able to distinguish persona data from real data when reviewing.
- **Stay consistent within each persona over time.** Voice, communication style, topics — these need to feel like the same person across sessions. Switching personas means context-switching as you journal.
- **Add new personas incrementally.** Don't try to populate a dozen personas before any have any data. Start with 2-3, see what's missing, add more.
- **Personas can evolve.** Real people change over months; personas can too. But document the change in the persona's profile so you remember what shifted.

---

## What this document is not

- A complete user research plan. That's what real user testing at v2 is for.
- A substitute for real users. Personas extend testable surface but don't replace the messy reality of unfamiliar users.
- A place for highly detailed character development. Just enough specificity to journal as them consistently. Over-development is fiction-writing, not testing.

---

*Last updated: initial version. Update as personas are refined or added.*
