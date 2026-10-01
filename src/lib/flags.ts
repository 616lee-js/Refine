/**
 * Build-time feature flags.
 *
 * Deliberately compile-time constants rather than environment variables: the
 * bundler can eliminate the disabled branches entirely, and there is no new env
 * surface to keep in sync across local, preview, and production.
 */

/**
 * Voice input. OFF.
 *
 * Two separate reasons, worth keeping distinct:
 *
 * 1. Audio retention does not work on serverless. v1 wrote `.webm` blobs to
 *    `./audio/[reflectionId]/`, and Vercel's filesystem is ephemeral, so
 *    anything written there is gone when the instance recycles. Shipping voice
 *    that silently discards recordings it implies it is keeping is worse than
 *    not shipping it.
 *
 * 2. The voice *session* model was chat-shaped. Its pause/completion trigger
 *    existed to decide when to send an articulation to Claude for a response —
 *    and journal entries have no send and no response. That hook now lives in
 *    `archive/chat-model/`.
 *
 * What survived, and is now in use:
 *   - src/lib/transcription/types.ts       TranscriptionProvider interface
 *   - src/lib/transcription/web-speech.ts  WebSpeech implementation
 *   - src/types/speech.d.ts                ambient SpeechRecognition types
 *
 * ── Dictation shipped 2026-10-01, and this flag did not change ────────────────
 * Speaking into an entry is live — see src/app/(protected)/use-dictation.ts and
 * components/ui/dictation-button.tsx. It did not need this constant because it
 * does not do either of the things this constant is about:
 *
 *   - It records nothing. No MediaRecorder, no blob, no upload, no file. Only
 *     text crosses from the browser, so reason 1 above does not apply: there is
 *     no recording to imply it is keeping.
 *   - It has no send and no trigger. Words land in the textarea as they are
 *     recognised, so reason 2 does not apply either.
 *
 * **This flag now means audio capture and retention, nothing else.** Turning it
 * on would mean keeping recordings, which still needs cloud storage this app does
 * not have, and a decision about keeping someone's voice that has not been made.
 * It is deliberately still false, and is still referenced only by
 * archive/chat-model/.
 */
export const VOICE_ENABLED = false;
