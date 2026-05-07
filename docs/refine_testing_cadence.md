# Refine — Testing Cadence and Feedback Templates

A guide to how testing works at each phase of the build, plus templates for capturing feedback efficiently.

This document is operational — meant to be consulted regularly during development and updated as the testing approach evolves. Not exhaustive.

---

## Core principles

**You are the user through v1 and v1.5.** No other humans use the app until v2. This is non-negotiable per the planning doc. Premature testing produces noise, not signal.

**Self-testing is rigorous, not casual.** You have full context on every session and can iterate fast. The discipline is being deliberate about what you're observing rather than just using the app and hoping insights emerge.

**Distinguish your experience from generalizable signal.** Your reactions matter but you're also the developer — you understand why things work in ways a new user wouldn't. Be conscious of when "this works" means "I know why this works" versus "anyone would find this useful."

**Document patterns, not incidents.** One frustrating session is noise. Three in a similar pattern is signal. The structured reviews are there to surface patterns you'd miss day-to-day.

---

## Testing approach by phase

### Phase 2 (current — core conversation loop)

**Type of testing:** Functional verification as Claude Code finishes chunks.

**What to do:**
- Test each chunk end-to-end as Claude Code completes it.
- Verify the conversation loop works, the classifier classifies, the orchestrator assembles layers correctly, encrypted data round-trips.
- After Phase 2 is complete, do one focused "real use" session — actual reflective conversation, not testing.

**What you're looking for:** Bugs and architectural mistakes. Not "is this the right product."

**What to write down:** Bugs and obvious rough edges in `docs/ux-observations.md`. Don't try to evaluate the product yet.

**Special note for Phase 2:** The first real-use session is your first contact with the actual product. If something feels seriously wrong — Claude is preachy, sycophantic, missing the mirror-and-guide stance — pause and queue a system prompt review before continuing the build.

---

### Phases 3–7 (rest of v1)

**Type of testing:** Functional verification + occasional real-use sessions.

**Specific things to test as features come online:**
- *Phase 4 (voice):* Does voice feel different from text in a way that affects what you share? Are transcripts accurate enough to be usable?
- *Phase 5 (memory editing):* When Claude infers something wrong about you, does the memory editing actually let you fix it cleanly? Does the system honor corrections without arguing?
- *Phase 6 (background summarization):* Are the Cabinet 2 summaries capturing tonal context, not just topics? (You'll be reading them to evaluate, even though they're not surfaced to users in v1.)
- *Phase 7 (scheduling and history):* Does the session history view feel informational rather than evaluative?

**What to write down:** UX observations, plus a small running list of system prompt issues for the eventual prompt review.

---

### After Phase 7 — the v1 self-testing period (4–8 weeks)

**The most important testing period in the entire build.** Most likely to be done badly because there's no external pressure.

**What this period accomplishes:**
- Generates real journaling data for v1.5 to design against.
- Exposes friction the build couldn't predict.
- Tests the mirror-and-guide stance against actual life.
- Tests safety architecture in real use.

**What to actually do:**
- Use the app daily or near-daily. Not as a test — as a journaling practice. Brief check-ins on quiet days are also data.
- Maintain `docs/ux-observations.md` continuously. Note friction as you encounter it.
- Do a structured review every 2 weeks (template below). Half an hour. Look for patterns, not incidents.
- Watch for designed-against failure modes specifically: sycophancy, companion drift, avoidance through journaling, narrative entrenchment.
- Start the synthetic personas alongside (see `docs/refine_test_personas.md`).

**Resist the urge to fix things one at a time.** Accumulate observations for at least 2–3 weeks before any focused improvement pass with Claude Code.

---

### Before starting v1.5

**Structured review of v1's foundation.** Probably worth doing with planning support to keep it disciplined.

**Questions for this review:**
- Is the basic experience sound enough to build longitudinal on?
- What patterns do *you* see in your accumulated entries? What would you want surfaced?
- Does the system prompt need refinement based on weeks of evidence?
- Are the Cabinet 2 summaries useful enough to build the synthesis layer on?
- Have any safety classifications been wrong, and if so, in which direction?

If foundational issues exist, fix them before adding the longitudinal layer. Don't build new on shaky old.

---

### During v1.5 build

**Same as v1 build patterns** — functional testing as Claude Code builds, real-use testing as features come online.

**Plus one specific addition:** Adversarial testing of the longitudinal feature against personas with no coherent pattern. Build a test mode that runs the synthesis layer against persona data and outputs results for your review. Validate the system doesn't manufacture insights from noise. This is the negative testing principle from the planning doc — most-skipped, most-important.

---

### v2 gate testing

**Conventional user testing finally enters.** Per the planning doc's hard gate:

- Clinical review of system prompt, Layer 3 fragments, tier classification, resource list.
- Privacy and legal review.
- Negative testing run on the full longitudinal feature.
- Closed alpha with 2-3 trusted people who have agreed to participate in a prototype.
- Structured feedback from alpha (see template below).
- Iterate based on alpha before expanding.
- Cautious expansion: small invited groups first, then open beta.

---

## Feedback templates

These are starting templates. Adjust them as you learn what's actually useful to capture.

### Template: bi-weekly self-review (during v1 self-testing period)

Use this every 2 weeks during the post-Phase-7 self-testing period. Spend 30 minutes. Don't skip even when nothing seems pressing.

```
DATE: 
PERIOD COVERED: 
SESSIONS LOGGED: 

1. USAGE PATTERN
- How often did I use the app this period?
- What modalities (voice/text/mixed)?
- What session types (scheduled/as-needed/guided)?
- Anything notable about when or why I used it?

2. WHAT WORKED
- Specific moments when the app served me well.
- Specific responses from Claude that landed.
- Friction-free experiences worth noting.

3. WHAT DIDN'T WORK
- Friction points I hit.
- Moments when Claude's response felt off (preachy, sycophantic, missing the moment, etc.).
- Things I wanted to do but couldn't, or that took too long.

4. DESIGNED-AGAINST FAILURE MODES — direct check-in
- Has Claude been sycophantic? (Examples)
- Has the app started feeling like a companion?
- Have I been using it to avoid conversations I should be having?
- Are there narratives the app has reinforced that I'm not sure are accurate?
- Has anything felt surveillance-y or pattern-matchy in a way that bothered me?

5. SYSTEM PROMPT OBSERVATIONS
- Any specific responses that suggest the prompt needs refinement?
- Any tier classifications that seemed wrong?
- Any moments where Claude broke the mirror-and-guide stance?

6. PATTERNS (the real point of this review)
- Across this period plus prior reviews, what patterns am I noticing?
- Are issues from prior reviews recurring? Worsening? Resolved?
- Anything I'm consistently avoiding or doing differently than designed?

7. ACTIONS
- What, if anything, needs to change before I continue?
- What goes on the queue for the next focused improvement pass?
- Anything urgent enough to address right now?
```

### Template: per-session quick capture (optional, for notable sessions)

Don't do this for every session — only when something stands out. Brief is fine.

```
SESSION DATE/TIME:
SESSION TYPE:
MODALITY:

WHAT STOOD OUT:
(Brief — a few sentences. What was notable about this session?)

WHY IT MATTERS:
(Is this a one-off or part of a pattern?)
```

### Template: alpha tester feedback (for v2 — not yet relevant)

When trusted alpha testers eventually use the app, you'll want structured feedback rather than just "did you like it?" Starting template:

```
TESTER PSEUDONYM:
PERIOD COVERED:
APPROXIMATE SESSIONS:

1. ENGAGEMENT
- How often did you use the app?
- Did you use it more, less, or about as much as you expected?
- What got in the way of using it more / why did you stop?

2. EXPERIENCE
- Describe a session that felt useful. What made it work?
- Describe a session that felt off. What didn't work?
- Did the app feel like what you expected from how it was described?

3. SAFETY AND TONE
- Did Claude ever feel preachy, judgmental, or distant?
- Did Claude ever feel sycophantic — agreeing with you when you would have benefited from pushback?
- Did the app handle hard moments well? (If applicable)
- Did you ever feel pathologized — like the app was treating you as more in crisis than you were?

4. THE LONGITUDINAL VALUE
- Did the longitudinal reflections feel accurate?
- Did they help you see something you couldn't see alone?
- Were any reflections wrong in a way that bothered you?

5. TRUST AND CONTROL
- Did you trust the app with what you shared?
- Did you ever want to edit or delete something? Were you able to?
- Did the privacy and transparency commitments feel real?

6. WOULD YOU USE IT
- If this were a real product, would you use it?
- What's missing or what would need to change?

7. ANYTHING ELSE
- What haven't I asked about that I should have?
```

---

## When testing reveals something foundational

Some testing observations will reveal that a foundational decision was wrong. This is fine — it's why the testing exists. The discipline:

- Don't change foundational decisions impulsively. Sit with the observation for at least one review cycle. Confirm it's a pattern, not an incident.
- When you do change something foundational, document why. Update the planning doc and the brainstorm summary so the reasoning persists.
- Remember the brainstorm summary captures *why* decisions were made. If you're considering reversing a decision, reread the original reasoning first. The new evidence may genuinely outweigh it — but you should be reversing deliberately, not because you forgot.

---

## What this document is not

- It's not a substitute for the planning doc. The planning doc is the source of truth for what gets built. This document is about how to evaluate what's been built.
- It's not exhaustive. Adapt the templates as you learn what actually helps you capture useful feedback.
- It's not a contract. If a template question isn't producing useful answers after a few uses, change it.

---

*Last updated: initial version. Update this document as the testing approach evolves.*
