# Refine — Build Narrative

A running summary of the work done on Refine and the significant decisions made along the way. Maintained as a working document for understanding the project's evolution and communicating about it.

This document is intentionally narrative — chronological by phase, with brief explanation of significant decisions. It is not a replacement for the planning doc (`refine_v1_planning.md`) or the brainstorm summary (`refine_brainstorm_summary.md`), which remain authoritative for what's being built and why. This is the shorter, evolving story.

---

## Planning phase

Before any code was written, the foundational structure of the product was worked out.

### Product identity

Reflective journaling tool with reflection and self-improvement practices supplemented by AI. Explicitly not an AI companion. Built on the belief that resources to support mental health management and growth toward self-directed goals should be accessible to all. Audience: adults seeking self-guided growth, in or out of therapy.

Positioning: wellness, evidence-informed, explicitly non-clinical. Not therapy. Doesn't diagnose. Doesn't treat conditions. A complementary reflective surface that operates with immediacy and self-direction the professional pathway structurally cannot offer.

### Significant decisions made during planning

**Four-tier safety architecture with continued presence.** Tier 0 (baseline), Tier 1 (elevated distress), Tier 2 (concerning indicators), Tier 3 (acute risk). The defining commitment: continued support is never contingent on the user accepting professional referrals. The app does not abandon users at the moment of their greatest need. Grounded in lived experience of how aggressive escalation harms users.

**Motivational Interviewing as primary conversational stance, with CBT and ACT as supporting techniques.** Framed as conversational tools, not delivered therapy. MI's evaluation framework (the MITI scale) supports eventual clinical review.

**Five-cabinet data architecture.** Cabinet 1 (raw entries), Cabinet 2 (structured summaries), Cabinet 3 (semantic embeddings, deferred to v1.5+), Cabinet 4 (assessment data, deferred), Cabinet 5 (synthesis layer, deferred). Two important properties: re-processability (summaries can be regenerated from raw entries as schemas evolve), and grounded insights (any insight surfaced should be traceable to specific entries).

**Four-layer context architecture.** Layer 1 (foundation model), Layer 2 (application system prompt, visible to user), Layer 3 (clinically-grounded reference fragments, pulled selectively), Layer 4 (user-specific context including memory, recent summaries, current conversation). The orchestrator assembles relevant pieces from each layer for every Claude call rather than concatenating everything.

**Insight scope: descriptive and connective freely; interpretive carefully and hedged; no suggestive or diagnostic-adjacent unsolicited.** The system describes observed features and recommends professional consultation rather than naming conditions, even when the user invites diagnostic framing.

**User autonomy over data as a first-order principle.** Users can view, edit, redact, and fully delete any stored content. Deletion means actual removal including from derived structures. User corrections are authoritative.

**Build sequencing: v1 (foundation, solo developer use), v1.5 (longitudinal features, persona testing), v2 (trusted tester release with hard gates).** The hard gates before v2: clinical review, privacy and legal review, cloud deployment with proper encryption, tester consent flows. Non-movable.

### Documents produced during planning

The planning phase produced multiple working documents that anchor the rest of the build:

- `refine_v1_planning.md` — authoritative specification for v1
- `refine_brainstorm_summary.md` — the reasoning behind the decisions
- `refine_testing_cadence.md` — testing approach by phase, with templates
- `refine_test_personas.md` — synthetic test personas for v1.5+ evaluation
- `refine_known_limitations.md` — living register of issues, limitations, design constraints
- `refine_test_prompts.md` — library of test cases for evaluating Claude's responses

---

## Phase 1 — Scaffolding and foundation

Set up the basic project structure: Next.js with TypeScript, Postgres via Docker, Drizzle ORM, Anthropic SDK. Database schema implemented per the data model. Field-level encryption integrated. Single-user passphrase auth as a placeholder.

### Significant decisions during Phase 1

**Tech stack chosen for solo development efficiency and v2 portability.** Next.js for the framework (React-based, good Claude Code support, clean path to PWA). Postgres via Docker locally for production-shape parity (chosen over SQLite to eliminate a future migration). Drizzle for the ORM (TypeScript-native, lighter than Prisma, more transparent SQL). Built-in Node `crypto` with AES-256-GCM for field-level encryption.

**Test data wipeability established as a standing principle.** v1 and v1.5 data will be wiped before v2 cutover. This means many data-shape decisions become two-way doors at the cost of one planned wipe. The principle: don't over-engineer for data preservation in v1; design carefully for architecture and security that persists, but treat data shapes as iterable.

**One-way vs two-way door framing established.** Decisions are explicitly classified by reversibility. One-way doors (schema fundamentals, encryption posture, auth model) get careful deliberation. Two-way doors (UI flows, copy, defaults) get reasonable choices and iteration.

---

## Phase 2 — Core conversation loop

Built the layered context orchestrator: a function that takes a session and a new user message, assembles the prompt from Layers 1-4, calls Claude, and returns a response. Layer 2 system prompt loaded from a versioned file. Layer 3 reference library scaffolded with initial safety protocols and MI notes. Tier classifier implemented as a separate Haiku call before the main response. Minimal chat UI.

### Significant decisions during Phase 2

**Separate tier classification call rather than inline.** Haiku-class model classifies each user message before the main response is generated. Cleaner separation, more evaluable, easier to tune. Classification logged for review.

**Conservative tier classification with explicit examples.** Metaphorical or general expressions of struggle stay at Tier 1; direct expressions about self-existence or self-harm move to Tier 2. Specific examples encoded in the classifier prompt to give Haiku concrete decision logic rather than abstract rules.

**Gentle explicit naming at Tier 2.** Not implicit (just offering resources) and not heavy explicit (pathologizing the user), but gentle naming in language about the user's experience and the app's limits. Threads the autonomy and continued-presence commitments.

**Tier 3 protocol explicitly avoids safety contracting.** No asking the user to promise they'll be safe or seek help. Honest about app limits, points to specific resources, names that the app remains a place to come back to. The "I'll be here when you want to come back" line is deliberate.

**Layer 2 prompt and Layer 3 protocols are versioned with changelog.** Every change tracked. The orchestrator logs which version was active for each session.

---

## Phase 3 — Reflection structure (originally "session structure")

Built the lifecycle for what was originally called sessions: three reflection types (scheduled, as-needed, guided), structured check-in varying by type, basic email/password signup-login replacing the passphrase placeholder, users table with HMAC email lookup, user_id foreign key on all data models, tier classification log viewer.

> **Correction (2026-07-29):** Phase 3 is complete *except guided reflections*, which are
> formally deferred. The `guided` type exists in the schema and history labels, but it is not
> selectable and the API rejects it; the home screen shows it as "Coming soon". The guided
> check-in shape was a documented Phase 3 pause point that was never closed. Recording it as a
> deliberate deferral rather than leaving the phase marked complete against an unmet definition.

### Significant decisions during Phase 3

**Real signup/login auth built in Phase 3, with explicit deferrals to v2.** Originally planned as v2 work, but moved earlier to support persona testing and multi-account use. The deferred pieces — email verification, password reset, MFA, rate limiting, social login, account deletion UI, CAPTCHA — all remain v2 work because they require email infrastructure and operational maturity that aren't appropriate for the current phase.

**User data model built as if multi-user is real, even though only the developer uses v1.** Users table includes fields needed for future auth even though unused in v1. Every data model has a real user_id foreign key. This avoids retrofitting at v2.

**Iron-session for session management in v1.** Encrypted cookies rather than DB-backed sessions. Acceptable for solo use; DB-backed sessions with individual revocation are a v2 capability.

---

## Phase 4 — Voice input and the conversational paradigm shift

Built voice input via the browser Web Speech API, with both raw audio and transcript stored. Transcription implemented as a swappable component (interface) so Whisper or Deepgram can replace it at v2 without refactoring.

But the more significant Phase 4 work was a fundamental reshaping of how reflections work conversationally.

### The conversational paradigm shift

Testing during Phase 3 surfaced that the default "Claude responds to every user message" pattern pulled toward AI-companion shape rather than reflective-tool shape. For reflective journaling, this undermines the theory of change — users learn about themselves through articulation, and constant AI response shapes their articulation rather than letting it be self-directed.

The Phase 4 reshaping: in voice mode, the user speaks freely across many utterances. Claude doesn't respond after each one. Claude responds when triggered by either a configurable pause duration (Off / 10s / 20s / 30s, default 20s, user-controllable per-user) or an explicit "I'm done" completion button.

This is a meaningful product shift, not just a feature addition. It changes the theory of what the app *is* in operation — closer to journaling with witness than chat with companion.

### Other significant decisions during Phase 4

**Per-utterance tier classification with highest-tier tracking.** When voice mode accumulates many utterances before responding, each utterance is classified individually as it's transcribed. The highest tier encountered across the articulation informs Claude's response. This catches embedded Tier 2/3 signals that whole-articulation classification would dilute.

**Accumulated articulation as the unit of input.** When Claude responds in voice mode, it responds to all utterances since its last response. The session log records the full articulation as one entry with utterance boundaries preserved, alternating with Claude's response entries.

**Web Speech API privacy implication noted explicitly.** Chrome sends audio to Google's servers for processing. Acceptable for solo testing; flagged in `refine_known_limitations.md` as something to revisit before v2 against PHI-grade privacy commitments.

---

## Phase 4.5 — Design system interlude

Between Phase 4 and Phase 5, a small focused interlude codified the design system that had emerged organically. Audit of existing patterns, draft of `refine_design_system.md` describing tokens / components / patterns / accessibility commitments, design tokens pinned in `tailwind.config.js`, shared components consolidated in `src/components/ui/`.

### Significant decisions

**Documentation and implementation kept architecturally separate.** The design system has three locations: `docs/refine_design_system.md` for description, `tailwind.config.js` for token definitions, `src/components/ui/` for components. Each plays a distinct role.

**Accessibility commitments codified from the start.** WCAG AA color contrast minimum, focus state expectations, semantic HTML conventions, motion sensitivity considerations. Easier to do right at this stage than to retrofit later.

---

## Phase 5 — Expanded scope: user memory, profile, and product reframing

Originally scoped narrowly to user memory and editing. Testing feedback after Phase 4 surfaced that user memory, the persistent profile, and the conversational pattern of Claude's responses were deeply intertwined. Phase 5 expanded substantially.

### What Phase 5 actually covered

**User memory and editing.** Memory entries proposed by background processing, stored with proposed status until user reviews and confirms. Only confirmed (active) memory flows into Layer 4 by the orchestrator. Full edit UI: view, edit, delete per entry, bulk actions, filter by kind.

**User profile and onboarding.** Persistent profile separate from session-derived memory. Profile captures stated tendencies, goals, background, interaction preferences. Editable in user settings. Stored in a dedicated `user_profiles` table (overriding Claude Code's recommendation of a JSONB column on `users` — the separate table better honors PHI-grade sensitivity and access pattern separation).

**Cancel/discard pattern.** Distinct from end-reflection. Cancel discards the reflection entirely with confirmation toast. End-reflection generates a closing response and marks the reflection ended. Confirmation toasts for destructive actions generally.

**Renames for product reframing.** "Sessions" → "Reflections" throughout user-facing surfaces, code, database, routes, and documentation. Technical contexts (auth sessions, iron-session library) remain unchanged. This is part of a broader shift from AI-companion framing to self-driven reflective journaling.

**Mirror as the conceptual home for Memory and eventual Insights.** Memory accessed under a top-level nav item called "Mirror." When Insights (v1.5+ synthesis) ships, it joins Memory under the same surface. The metaphor — silver becomes valuable through refinement and can then hold a reflection — maps to the product's purpose.

> **Correction (2026-07-29):** Phase 5's spec included "system prompt visible to user
> (read-only)" — a transparency-principle commitment, not a nice-to-have. It was missed and the
> phase was marked complete without it. Built on 2026-07-29 as a read-only Layer 2 viewer at
> `/settings/system-prompt`, linked from profile settings. Layer 3 fragments are deliberately
> not surfaced there; that is a separate decision.

### Significant decisions during Phase 5

**Phase 5 expansion was driven by testing feedback, not scope creep.** Multiple issues surfaced during Phase 4 testing that turned out to be architecturally connected. Acknowledging the expansion explicitly rather than pretending it was always in scope.

**Memory generation deferred to Phase 6.** Discovered during Phase 5 work that memory extraction should operate on reflection summaries (Phase 6 work) rather than raw entries. The original phase ordering had a dependency wrong. Phase 6 now precedes the completion of Phase 5's memory extraction. The user-facing memory infrastructure (UI, edit, manual add) shipped in Phase 5; automatic extraction lives in Phase 6.

**System prompt review still pending.** Testing surfaced specific issues with Claude's responses (too many affirmations, question loops, length). The focused system prompt review was scheduled to happen before Phase 6 starts, so summaries are generated against a refined prompt rather than the current one.

---

## Standing principles that emerged across phases

A few working principles emerged during the build that aren't tied to any one phase:

**Test data is wipeable.** v1 and v1.5 data will be wiped before v2 cutover. Data-shape decisions are two-way doors at the cost of one planned wipe. This shapes how much engineering rigor is appropriate for data structures versus auth/encryption/architecture.

**One-way vs two-way door framing applied explicitly.** Decisions are classified by reversibility. Proportional care: careful deliberation on irreversible decisions, fast iteration on reversible ones.

**Observations-driven iteration.** Testing observations live in `docs/refine_ux_observations.md`, accumulating as issues are discovered. Resolution dates are added when issues are addressed; entries are not deleted. This preserves the history for eventual system prompt review and v2 clinical review.

**Naming reinforces product framing.** The product is reflective journaling supplemented by AI, not AI companionship. Names throughout the codebase, database, UI, and documentation should reinforce this framing. "Session" is acceptable only in technical contexts that aren't user-facing.

**Documentation lives outside code.** Working documents in `docs/` describe the project. Code is the project. `CLAUDE.md` instructs Claude Code on rules. Each artifact has a distinct role and shouldn't blur into the others.

**External calendar integration is deliberately not planned.** Privacy risk (reflection patterns visible in third-party systems), companion-drift risk (the app becomes "an appointment in your day"), engineering cost without serving core value. Internal calendar/recurrence functionality is in scope for Phase 7.

---

## Deployment phase — Vercel + Supabase, text-only (2026-07-29)

Between Phase 5 and Phase 6, the project moved from local-only hosting to a deployed
build on Vercel with Supabase Postgres, to put the app in front of a small group of
invited testers.

**This deliberately supersedes a written v1 non-goal.** `refine_v1_planning.md` scoped
v1 to local hosting and placed cloud deployment and non-owner users behind the
non-movable v2 gate. The decision was made with that trade-off explicit: real feedback
from a few known testers was judged more valuable now than holding local-only, and the
deployment is small enough to constrain. The accepted risk posture is invite-gated
signup with single-use codes, a small and known tester group, no public
discoverability, and field-level encryption with environment-scoped keys. The v2 gate
items — clinical review, privacy and legal review, tester consent flows — are **not**
satisfied and are not claimed to be. Recorded in full at the v1 non-goals section and
in LIM-006.

**Voice is feature-flagged off, not removed.** Serverless has no persistent filesystem,
so the local-disk audio path had to go. The TranscriptionProvider interface, the
WebSpeech implementation, the accumulated-articulation logic, the pause/completion
paradigm, and per-utterance tier classification are all preserved for re-enablement
once cloud audio storage exists.

**Supabase is used purely as a Postgres host** — not its auth, not its storage, not
RLS. The app's own email/password + iron-session auth and AES-256-GCM field encryption
are unchanged.

### What a pre-deploy audit surfaced

Preparing for deployment turned up several things worth recording:

- **Prompts were loaded from disk at runtime** via `readFileSync(process.cwd(), …)` with
  a runtime-variable filename. This works locally and fails on Vercel — the bundler
  cannot trace a variable path, so the `.md` files would have been absent from the
  deployed function and the first message would have 500'd. Prompts are now compile-time
  imports, part of the module graph.
- **`/admin/safety-log` had no authorization at all** and was being statically
  prerendered — which would have baked decrypted cross-user journal content into a
  CDN-served HTML file. Now gated by `requireAdmin()` (404, not 403) and forced dynamic.
  The structural cause: `src/app/admin/` sits outside the `(protected)` route group and
  inherits no auth. Recorded in `CLAUDE.md`.
- **The Tier 2/3 resource-rendering gap** — the Layer 3 protocol told Claude the app
  would render a resource list, and the app did not. Resources reached Claude's context
  and never the user's screen. Closed with a tier-conditional resource panel that
  renders alongside Tier 2/3 responses, including reflection-closing messages.

### Tier 0 decision: no ambient crisis framing

Crisis resources were initially made persistent on every authenticated page, matching
the planning doc's Tier 0 language ("always present, never disruptive"). That was then
reversed deliberately.

Refine is an AI-augmented reflective journaling tool, not a crisis-centric mental health
app. An always-present crisis line framed every screen — home, Mirror, history, settings
— around crisis, which contradicts the product's positioning. The posture is now:
**normal reflection carries no ambient crisis framing; resources surface when a Tier 2/3
signal is actually detected**, which is the moment they are relevant.

This supersedes the planning doc's Tier 0 specification and is recorded as a decision
rather than drift. The trade-off is real and is tracked in LIM-016: the tier-conditional
panel is now the *only* resource surface, which makes classifier accuracy load-bearing.
A false negative previously meant a degraded experience; it now means a user in distress
sees no resources at all. That raises the stakes on reviewing the safety log during
testing, and it compounds LIM-001 (the classifier sees each message in isolation).

One consequence caught in the same pass: the Tier 2 panel had omitted 988 and Crisis
Text Line specifically because the footer displayed them permanently. Removing the footer
invalidated that premise, so they were restored to Tier 2 — otherwise a Tier 2 user would
have seen no immediate crisis line anywhere.

## Current state

Phase 5's buildable work is complete, plus the deployment-phase work above. Remaining
before testers are admitted:

1. **Tier 2/3 resource rendering** — blocking. The safety architecture promises more
   than the app delivers at exactly the moment it matters.
2. **Crisis resources in onboarding** — blocking. A stated v1 scope requirement.
3. **System prompt review** — pending. A focused conversation to refine the Layer 2
   prompt, Layer 3 fragments, and tier classifier against accumulated observations.
4. **Phase 6 — reflection summaries and memory extraction** — pending. Cabinet 2
   summaries plus the extraction that operates on them. Its background processing must
   be serverless-compatible; naive fire-and-forget is killed when a Vercel function
   returns.

---

## How to use this document

Read it to understand the project's evolution at a glance. Reference specific phases or decisions when communicating with others about the work. Add to it as phases complete.

This document is updated by the developer (with planning support when useful) at meaningful milestones — usually phase completions or significant decision points. Not a real-time log; a periodic narrative.

If something in this document conflicts with the authoritative documents (`refine_v1_planning.md`, `refine_brainstorm_summary.md`), those win — this document is shorter and may have summarized something imperfectly. Worth correcting here if a conflict is found.

---

*Last updated: initial version. Update at phase completions and major decision points.*
