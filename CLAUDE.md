# Refine — Mental Health App

## What this project is

A web-based reflective journaling tool with reflection and self-improvement
practices supplemented by AI. Single-user (the developer) through v1 and v1.5;
trusted-tester deployment at v2 with hard gates.

Full project specification: `docs/refine_v1_planning.md`
Reasoning behind decisions: `docs/refine_brainstorm_summary.md`

## Working rules

1. Planning mode by default. Present plans as bulleted lists for confirmation
   before writing or editing code.
2. Work one phase at a time. Do not get ahead of the build sequence in the
   planning doc. Stop at phase boundaries and wait for confirmation.
3. Within a phase, work in small reviewable chunks. Build, show, confirm,
   continue.
4. When the planning doc doesn't answer a question, surface it. Don't guess.
5. Resist scope expansion. Check `v1 non-goals` before adding anything.
6. Before producing long output or doing anything expensive, name the
   tradeoff and check for cheaper alternatives.
7. Pause before drafting any Layer 2 prompt content, Layer 3 protocols, or
   tier classifier content. These get worked through with planning support
   first, not drafted unilaterally.
8. Distinguish one-way door decisions from two-way door decisions:
   - One-way doors (schema, encryption keys, architecture, anything touching
     stored data): surface explicitly — "this is a one-way door because
     [reason]; recommending X; deferral cost is Y" — and pause for
     confirmation before proceeding.
   - Two-way doors (UI, copy, prompts, defaults, anything iterable in real
     use): identify as such and move quickly — "two-way door, going with X,
     iterate based on real use."
   - Decisions that look two-way but carry one-way implications once data
     accumulates: call out the asymmetry explicitly.

## Stack and architecture

- Next.js (App Router) + TypeScript
- PostgreSQL via Docker locally (production-shape for clean v2 migration)
- Drizzle ORM (TypeScript-native, lightweight)
- Anthropic API: Sonnet for main responses, Haiku for tier classification
- Web Speech API for voice in v1 (free, browser-native)
- Built-in Node `crypto` with AES-256-GCM for field-level encryption
- Email/password auth for v1 (bcrypt + iron-session encrypted cookies; DB-backed sessions and individual revocation at v2)

Layered context architecture (the orchestrator assembles these for every
Claude call):
- Layer 1: model selection
- Layer 2: application system prompt (visible to user, read-only)
- Layer 3: clinically-grounded reference fragments, pulled selectively
- Layer 4: user-specific context (memory, recent session summaries,
  current conversation)

Data architecture (filing-cabinet model):
- Cabinet 1: raw entries (encrypted, immutable)
- Cabinet 2: structured narrative summaries (Phase 6+)
- Cabinets 3-5: deferred to v1.5+

## Security non-negotiables

- Anthropic API key lives only in `.env.local`. Never logged, echoed,
  written elsewhere, or sent to the browser. Server-side only.
- `.env.local` is in `.gitignore`. Verify before any commit.
- Field-level encryption on all journal content. User data treated with
  PHI-grade rigor.
- User memory is editable; deletion means genuine deletion including
  derived structures.

## Phase status

Phase 1 — complete
Phase 2 — complete
Phase 3 — complete
Phase 4 — complete
Phase 5 — in progress (user memory + profile + onboarding; extraction prompt + system prompt review pending)
Phase 6+ — not started

## Voice paradigm note

Phase 4 adds voice input via Web Speech API. The conversational paradigm shifts:
utterances accumulate client-side; per-utterance classification fires via
`/api/classify`; the accumulated message (plus maxTier) is sent to `/api/chat`
only when the user signals readiness (pause timer or "I'm done"). Audio is saved
per-trigger to `./audio/[sessionId]/[uuid].webm` (unencrypted in v1). The
TranscriptionProvider interface (`src/lib/transcription/types.ts`) is a one-way
door — swap implementations without touching the hook.

## Where things live

- Planning specification: `docs/refine_v1_planning.md`
- Decision reasoning: `docs/refine_brainstorm_summary.md`
- Prompt changelog: `docs/prompt-changelog.md`
- v2 roadmap (deferred capabilities): `docs/v2-roadmap.md`
- Layer 2 system prompt: `src/lib/layer2/system-prompt.md`
- Layer 3 fragments: `src/lib/layer3/*.md`
- Build notes (forward-looking requirements): `docs/build-notes.md`
- Testing cadence and templates: `docs/refine_testing_cadence.md` — operational
  reference; consult when testing decisions arise; do not modify or populate
  templates unless explicitly asked
- Test prompts library: `docs/refine_test_prompts.md` — run before committing
  any system prompt or Layer 3 protocol change; propose new entries (TC-###,
  ARC-###, EDGE-### format) and wait for confirmation before adding; do not
  script the test harness yet (deferred)
- Known limitations register: `docs/refine_known_limitations.md` — living
  document; propose new entries (LIM-### tag, severity, status, description,
  mitigation) and wait for confirmation before adding; during v1 self-testing
  period the user leads and you help format
- Test personas: `docs/refine_test_personas.md` — dormant until after Phase 7;
  do not reference during current build phases; surface before v1.5 starts
- UX observations: `docs/refine_ux_observations.md` — log when user provides
  feedback on specific responses or interactions (OBS-### format, date,
  description, session/entry IDs if applicable); mark resolved with date rather
  than deleting; do not edit prompts or UI copy in response to individual
  entries — this feeds a deliberate focused review, not in-flight fixes
- Design system: `docs/refine_design_system.md` — tokens, component patterns,
  accessibility commitments, open questions (OQ-### format). Consult when
  building new UI; if a pattern is needed that isn't covered, propose adding it
  before building. Implementation: tokens in `src/app/globals.css` (`@theme`),
  shared components in `src/components/ui/`

## Phase 5 additions

### New pages (Phase 5)
- Memory UI: `src/app/(protected)/memory/page.tsx` — active/proposed memory, per-entry confirm/edit/delete, add new, bulk delete
- Profile settings: `src/app/(protected)/settings/profile/page.tsx` — three optional profile fields (tendencies, goals, background)
- Onboarding: `src/app/(protected)/onboarding/page.tsx` — post-signup profile capture, redirects to `/`

### New schema
- `user_profiles` table: PHI-isolated encrypted profile blob, one row per user
- `sessions.extractionStatus`: null → pending → running → succeeded/failed (tracks memory extraction lifecycle)

### Memory state model
Reuses `user_memory.lastConfirmedAt` as proposed/active discriminator:
- `lastConfirmedAt IS NULL + isActive = true` → proposed (claude-generated, awaiting confirmation)
- `lastConfirmedAt IS NOT NULL` → active (confirmed or user-added)
- Layer 4 orchestrator query: `isActive = true AND lastConfirmedAt IS NOT NULL`

### Two pending PAUSE points
- Memory extraction prompt (Step 11) — requires planning review before drafting
- System prompt review — Layer 2 edits require focused review conversation before any changes