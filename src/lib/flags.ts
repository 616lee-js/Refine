/**
 * Build-time feature flags.
 *
 * Deliberately compile-time constants rather than environment variables: the
 * bundler can eliminate the disabled branches entirely, and there is no new env
 * surface to keep in sync across local, preview, and production.
 */

/**
 * Voice input. OFF for the Vercel deployment.
 *
 * Voice itself works — the Web Speech API is browser-native and needs no server.
 * What does not work on serverless is audio retention: v1 wrote `.webm` blobs to
 * `./audio/[reflectionId]/`, and Vercel's filesystem is ephemeral, so anything
 * written there is gone when the instance recycles.
 *
 * Rather than ship voice that silently discards the recordings it implies it is
 * keeping, voice is disabled until cloud audio storage exists.
 *
 * PRESERVED, not deleted — re-enabling is flipping this constant plus restoring
 * the audio upload path:
 *   - src/lib/transcription/types.ts       TranscriptionProvider interface
 *   - src/lib/transcription/web-speech.ts  WebSpeech implementation
 *   - src/app/(protected)/use-voice-session.ts
 *       accumulated articulation, pause/completion trigger, per-utterance
 *       tier classification with running max
 *   - src/app/api/classify/route.ts        per-utterance classification
 *   - src/app/api/reflections/[id]/cancel-utterance/route.ts
 *   - voiceCadence in src/app/api/user/preferences/route.ts
 *   - entries.rawAudioRef column (stays null while voice is off)
 */
export const VOICE_ENABLED = false;
