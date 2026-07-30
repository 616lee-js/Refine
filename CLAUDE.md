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

## Naming conventions

Names throughout this codebase must reinforce the reflective journaling framing —
self-driven reflection, journaling practice, user agency. Names that frame the app
as AI-companion, chatbot, therapist-substitute, or generic conversational AI are
wrong for this product. Check any new name against this framing before applying.

- **reflection** — a user's completed reflective experience (DB table: `reflections`,
  route: `/reflection/[id]`, list: `/reflections`)
- **entry** — an individual message within a reflection (DB table: `entries`)
- **Mirror** — user-facing name for the shared Memory + Insights surface (v1.5+).
  Nav label: "Mirror". Route: **`/mirror`** (renamed from `/memory` 2026-07-29 for
  consistency with the label). Internal code, DB, and APIs keep "memory" —
  `/api/user/memory`, the `user_memory` table — and eventual "insights". Mirror is
  the user-facing container name only. Same split as Reflections/`journal_entries`.
  Metaphor: silver refined → mirror → holds a reflection. In v1 Mirror shows
  memory entries only; Insights becomes a second section when it ships in v1.5.
- **session** — stays only in technical, non-user-facing contexts: auth sessions,
  iron-session library, HTTP sessions, browser session APIs. Never use for the
  journaling experience.

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
- Layer 4: user-specific context (memory, recent reflection summaries,
  current conversation)

Data architecture (filing-cabinet model):
- Cabinet 1: raw entries (encrypted, immutable)
- Cabinet 2: structured narrative summaries (Phase 6+)
- Cabinets 3-5: deferred to v1.5+

## Deployment — Vercel + Supabase (text-only)

Supabase is a **Postgres host and nothing else** — not its auth, not its storage,
not RLS. The app's own email/password + iron-session auth and AES-256-GCM field
encryption are unchanged.

### Connection strings

| Var | Which string | Used by |
|---|---|---|
| `DATABASE_URL` | Transaction pooler, port **6543** | the app |
| `DATABASE_URL_DIRECT` | Session pooler, port **5432** | migrations + CLI scripts only |

The true direct host (`db.<ref>.supabase.co`) is **IPv6-only and unreachable from
this network** — it has an AAAA record and no A record. The session pooler is the
permanent substitute for "direct" here; it is safe for DDL, unlike transaction
mode.

Transaction mode (6543) forbids prepared statements and session state. Nothing
uses them: drizzle's node-postgres driver only prepares on an explicit
`.prepare()`, and no call site does. **Adding one would break in production
only.** Explicit `db.transaction()` is fine — the connection pins for its
duration, which is what makes the invite-code claim safe.

### TLS

Supabase serves its database endpoints from its **own private CA**, not a
publicly-trusted one. Every config that checks the system trust store fails with
`SELF_SIGNED_CERT_IN_CHAIN`. The root is pinned in `src/lib/db/supabase-ca.ts`
and used by both the app pool and drizzle. Do not replace it with
`rejectUnauthorized: false` — and note that removing the `ssl` option entirely is
worse still, because it connects in **plaintext**. See LIM-017.

### Migrations

Manual, never on deploy:

```
npm run db:migrate      # reads DATABASE_URL_DIRECT from .env.local
```

`npm run db:generate` writes to `drizzle/migrations/`. The pre-squash migrations
are archived in `drizzle/archive-pre-squash-2026-07-29/` — the old `0003`
contained a `DROP TABLE ... CASCADE` and must never be re-applied.

### Invite codes

```
npm run invites -- generate 1 [--expires <days>] [--note "text"]
npm run invites -- list
npm run invites -- revoke <CODE>
npm run invites -- whoami <email>     # user UUID, for ADMIN_USER_IDS
```

Signup requires a valid, unused, unexpired, unrevoked code. `scripts/seed.ts`
requires one too — there is deliberately no bypass path.

### Keep-alive

`vercel.json` runs `/api/health` daily. Free-tier Supabase projects pause after
~7 days idle and need a manual un-pause. The endpoint runs a real `SELECT 1` — a
bare 200 would not touch Postgres and the project would pause anyway.

## Schema ownership — Drizzle only

**Drizzle is the sole owner of the database schema.** Migrations live in
`drizzle/migrations/`, are generated with `drizzle-kit generate`, and are applied
manually with `npm run db:migrate` against `DATABASE_URL_DIRECT`.

Supabase's GitHub integration must stay **disabled** for migration-apply. Two
systems writing one schema means the Supabase side diffs against a database it
did not create, and the conflict surfaces as a failed or destructive deploy
rather than a clean error.

Consequences to hold to:
- Never run `supabase init` or create a `supabase/` directory. It is gitignored
  as a backstop, but the real rule is: don't.
- Never add `@supabase/*` packages for database access. The app connects with
  `pg` over a connection string; Supabase is a Postgres host and nothing else —
  not its auth, not its storage, not RLS.
- `npm run db:reset` refuses to run against a non-localhost `DATABASE_URL`. That
  guard exists because `.env.local` now points at Supabase; there is no override
  flag by design.

## Route protection — structural gotcha

Pages under `src/app/(protected)/` inherit an auth check from that route group's
`layout.tsx`, which calls `getSession()` and redirects when there is no session.

**`src/app/admin/` sits OUTSIDE that route group and inherits nothing.** Anything
added under `src/app/admin/` must gate itself explicitly with `requireAdmin()`
from `src/lib/auth/admin.ts`. `src/middleware.ts` is not a substitute — it only
checks that a session cookie is *present*, not that it is valid, and it runs in
the edge runtime where the real check cannot.

This is the pattern that caused a real miss: `/admin/safety-log` shipped reading
and decrypting every user's journal content with no session check at all, and was
additionally being statically prerendered — which would have baked decrypted PHI
into a CDN-served HTML file and run any authorization check once at build time
rather than per visitor.

Rules for anything under `src/app/admin/`:
- Call `await requireAdmin()` before any query. It responds `notFound()` (404,
  not 403 — a 403 confirms the route exists).
- Add `export const dynamic = "force-dynamic"` so protection never depends on a
  `cookies()` call as a side effect.
- Gate every **server action** separately. Server actions are independently
  addressable endpoints; a check on the page that renders them does not protect
  them.
- Admin membership comes only from the `ADMIN_USER_IDS` env var. There is no
  admin column, no first-user-is-admin, no default, and no code path that grants
  it. Fail closed when unset.

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
Phase 3 — complete **except guided reflections, formally deferred** (2026-07-29). The
  `guided` enum value exists and `/reflections` renders a label for it, but the type
  is not selectable and `POST /api/reflections` rejects it. The home screen shows it
  as "Coming soon". Guided check-in shape was a Phase 3 pause point that was never
  closed; it is now a deliberate deferral, not an outstanding task.
Phase 4 — complete
Phase 5 — complete (user memory + profile + onboarding + full terminology rename).
  The spec's "system prompt visible to user (read-only)" was missed at the time and
  was built on 2026-07-29 at `/settings/system-prompt`, linked from profile settings.
Phase 6 — not started (blocked: system prompt review required first)
Phase 7+ — not started

## Voice paradigm note

Phase 4 adds voice input via Web Speech API. The conversational paradigm shifts:
utterances accumulate client-side; per-utterance classification fires via
`/api/classify`; the accumulated message (plus maxTier) is sent to `/api/chat`
only when the user signals readiness (pause timer or "I'm done"). Audio is saved
per-trigger to `./audio/[reflectionId]/[uuid].webm` (unencrypted in v1). The
TranscriptionProvider interface (`src/lib/transcription/types.ts`) is a one-way
door — swap implementations without touching the hook.

## Where things live

- Operations guide: `docs/refine_operations.md` — running the deployed app:
  invite codes, admin access, health checks, troubleshooting. Written for the
  product owner to use without assistance; keep it jargon-free if editing.
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
  description, reflection/entry IDs if applicable); mark resolved with date rather
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
- `reflections.extractionStatus`: null → pending → running → succeeded/failed (tracks memory extraction lifecycle)

### Memory state model
Reuses `user_memory.lastConfirmedAt` as proposed/active discriminator:
- `lastConfirmedAt IS NULL + isActive = true` → proposed (claude-generated, awaiting confirmation)
- `lastConfirmedAt IS NOT NULL` → active (confirmed or user-added)
- Layer 4 orchestrator query: `isActive = true AND lastConfirmedAt IS NOT NULL`

### Phase 5 also included
- Full terminology rename: "session" → "reflection" throughout — DB schema, routes, code, docs
- Phase ordering decision: memory extraction deferred to Phase 6 (must consume summaries, not raw entries)
- Standing naming convention section added (see above)

### PAUSE before Phase 6
- **System prompt review required** — testing surfaced affirmation-heavy responses, question loops, length
  issues. Layer 2 edits must be reviewed in a focused conversation before Phase 6 starts.
- Memory extraction prompt (Step 11) — planned as part of Phase 6 design, not separately