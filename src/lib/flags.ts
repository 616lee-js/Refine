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
 * What survives and is genuinely reusable for dictating into a journal textarea:
 *   - src/lib/transcription/types.ts       TranscriptionProvider interface
 *   - src/lib/transcription/web-speech.ts  WebSpeech implementation
 *   - src/types/speech.d.ts                ambient SpeechRecognition types
 *
 * Re-enabling voice for journal entries is therefore NOT just flipping this
 * constant: it needs a dictation integration (provider → textarea) plus cloud
 * audio storage. The old accumulate-and-trigger paradigm is not what a writing
 * surface wants — see archive/chat-model/README.md.
 */
export const VOICE_ENABLED = false;
