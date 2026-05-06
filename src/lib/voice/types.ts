/**
 * Abstraction layer for voice transcription providers.
 * v1 uses WebSpeechProvider. Swap to WhisperProvider in a later phase
 * by implementing this interface and updating the provider config.
 */
export interface TranscriptionProvider {
  /** Returns true if this provider can run in the current environment */
  isSupported(): boolean;
  /** Starts a transcription session. Calls onTranscript as words are recognized. */
  transcribe(
    onTranscript: (text: string, isFinal: boolean) => void
  ): TranscriptionSession;
}

export interface TranscriptionSession {
  start(): void;
  stop(): void;
}
