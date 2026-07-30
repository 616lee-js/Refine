# Archive — chat-model reflection code

**Retired 2026-07-29. Reference material only. Not maintained. Not reactivatable
as-is.**

This is the turn-by-turn AI conversation model that open reflections used before
they became journal entries. It is kept so the framework check-in and
questionnaire workflows can be mined for parts, not because it is expected to run
again.

## Why it cannot simply be switched back on

It targets database tables that no longer exist. The schema redesign dropped
`reflections`, `entries`, and `check_ins` in favour of `journal_entries` and
`questionnaire_responses`. Every file here queries the old names.

It is also excluded from `tsconfig.json`, so nothing in it is typechecked and it
will drift silently as the rest of the codebase moves. Treat any of it as a
starting point to rewrite, never as a module to import.

## Why the chat model was retired

Phase 4 testing found that responding to every user message pulled the product
toward AI-companion shape rather than reflective-tool shape, which undermines the
theory of change: users learn about themselves through their own articulation, and
constant AI response shapes that articulation instead of letting it be
self-directed. The voice paradigm shift (accumulate utterances, respond only on a
pause or an explicit "I'm done") was a partial correction. Removing AI from the
writing surface entirely is the full one.

## What is here

| Path | What it was |
|---|---|
| `src/app/(protected)/chat.tsx` | The turn-by-turn chat UI |
| `src/app/(protected)/use-voice-session.ts` | Voice session hook — accumulated articulation, pause/completion trigger, per-utterance classification with running max |
| `src/app/api/chat/route.ts` | Streamed Claude response, `X-Tier` header, post-response entry save |
| `src/app/api/classify/route.ts` | Per-utterance tier classification during voice input |
| `src/app/api/reflections/[id]/end/route.ts` | Generated the AI closing message and marked the reflection ended |
| `src/app/api/reflections/[id]/abandon/route.ts` | Discarded reflections with no user entries — actively wrong under a draft model |
| `src/app/api/reflections/[id]/cancel/route.ts` | Hard-deleted a reflection; superseded by trash |
| `src/app/api/reflections/[id]/cancel-utterance/route.ts` | Removed pending per-utterance safety rows |
| `src/lib/orchestrator/index.ts` | `runOrchestrator`, `runReflectionClosing` |
| `src/lib/orchestrator/context.ts` | Layer 2/3 assembly, `buildLayer4Context`, per-call composition logging |

## What was deliberately NOT archived, and why

These were rescued before the archive because live code depends on them:

- **`src/lib/safety/classifier.ts`** (was `src/lib/orchestrator/classifier.ts`) —
  the tier classifier. `src/lib/safety/classify-and-log.ts` imports it, so the
  open-entry safety path would have broken if it had moved here.
- **`src/lib/safety/prompt-version.ts`** — `classifier.ts` depends on it.
- **`src/lib/transcription/*`** and **`src/types/speech.d.ts`** — the WebSpeech
  provider is reusable for dictating into a journal textarea. Only the
  send-trigger hook above is chat-shaped; the transcription layer is not.
- **`src/lib/layer2/*.md` and `src/lib/layer3/*.md`** — the classifier prompt is
  still in use, and `/settings/system-prompt` imports the Layer 2 prompt directly.

## Worth reading before designing the framework check-in

Two pieces here solved real problems and should be understood rather than
reinvented:

1. **Per-utterance classification with a running max** (`use-voice-session.ts`).
   Classifying a whole articulation at once dilutes an embedded Tier 2/3 signal.
   The journal path reuses this idea via paragraph chunking in
   `src/lib/safety/chunk.ts`.
2. **`buildLayer4Context`** (`orchestrator/context.ts`) — the only implementation
   of assembling a user's memory and profile into prompt context. **Phase 6 will
   need this.** It has to be rewritten against `journal_entries`, but start from
   here rather than from nothing.
