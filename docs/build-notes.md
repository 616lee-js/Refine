# Refine — Build Notes

Design decisions and forward-looking requirements that don't fit in the planning doc or v2-roadmap. Read this before starting each phase.

---

## Phase 6 — Background Summarization (Cabinet 2)

**Requirement:** The Cabinet 2 narrative summary must capture tonal and emotional context, not just topics.

The summary exists so that future sessions can open with appropriate awareness of where the user was last time — not just what they talked about, but how they were doing. A topic-only summary ("user discussed work stress, relationship difficulty") misses the thing that matters: was the user holding it together or barely keeping it together? Were things shifting? What was the emotional register of the session?

When designing the summarization prompt in Phase 6, the summary should answer:
- What was the user carrying? (topics + emotional weight)
- What was the tone and texture of how they were? (not just what was discussed)
- Was there any movement or shift during the session?
- Anything the next session should be gently aware of?

This is what enables the model to open a new session with calibrated presence rather than a blank-slate greeting that ignores history.

---

## Phase 6 — background processing must be serverless-compatible

**Requirement:** summary generation and memory extraction cannot be naive fire-and-forget.

The app now runs on Vercel. A serverless function is killed once it returns a response, so
work kicked off with an un-awaited promise after the response is sent will be terminated
partway through — sometimes, unpredictably, which is worse than failing outright.

**This was not hypothetical.** `/api/chat` and `/api/reflections/[id]/end` both shipped with
exactly this bug: the assistant entry save, the closing message save, and the `endedAt`
update all ran as un-awaited promises after `controller.close()`. Fixed 2026-07-29 —
reflections could otherwise have intermittently failed to save once deployed.

**Use `persistAfterResponse()` from `src/lib/after-response.ts`** for any write that has to
outlive a response. It wraps Next's `after()` (which maps to the platform `waitUntil`),
guarantees the held-open promise always settles so a function can never hang for its full
`maxDuration`, and logs failures. Two constraints it encodes:

- It must be called from the **route handler body**, not from inside a stream callback —
  `after()` requires an active request context.
- Streaming routes need `export const maxDuration = 60` (Hobby ceiling); the default is 10s,
  which an LLM completion plus a post-response write can exceed.

For work heavier than a couple of inserts — which Phase 6 summarization will be — prefer a
cron-driven worker that picks up `extraction_status = 'pending'` rows over extending a
user-facing request. The `extraction_status` column already exists on `reflections` for
exactly this lifecycle (null → pending → running → succeeded/failed), and a daily cron is
already configured for the keep-alive.

---

## Phase 6 — per-call prompt composition logging is now available (built 2026-07-29)

The planning doc asked for the orchestrator to log which Layer 3 fragments and which
Layer 4 items were included in each call. That was missing and has been built:

- `logPromptComposition()` in `src/lib/orchestrator/context.ts` emits one structured JSON
  line per Claude call — tier, Layer 2 version, the Layer 3 fragments used with their
  versions, Layer 4 memory count and kinds, whether a profile was included, and history
  length. **Metadata only — never content.**
- `buildSystemPrompt()` returns `{ prompt, layer2Version, layer3Fragments }` rather than a
  bare string, and `buildLayer4Context()` returns `{ text, memoryCount, memoryKinds,
  hasProfile }`.
- Prompt versions are parsed from each fragment's own `# Version:` header via
  `promptVersion()`, so `safety_log.classifier_version` records the version actually
  loaded instead of a hardcoded `"v1"` literal. Bumping a header is now sufficient to make
  old and new rows distinguishable.

**Why Phase 6 cares:** summaries and extracted memory need to be attributable to the prompt
version that produced them, or re-processability is guesswork. `reflection_summaries.generation_version`
should be populated the same way — from the summarization prompt's header, not a literal.

---

*Add notes here as they come up during build — especially requirements identified in one phase that belong to a later phase.*
