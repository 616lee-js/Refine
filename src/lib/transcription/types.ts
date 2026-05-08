export interface TranscriptionCallbacks {
  /** Fired for each interim (non-final) result as the user speaks. */
  onInterim: (text: string) => void;
  /** Fired when a final utterance is committed. */
  onUtterance: (text: string) => void;
  /** Fired when the provider restarts itself after an unexpected stop. */
  onRestart: () => void;
  /** Fired on unrecoverable provider error. */
  onError: (err: Error) => void;
}

export interface TranscriptionProvider {
  /** Begin capturing audio and emitting callbacks. */
  start(callbacks: TranscriptionCallbacks): void;
  /** Stop capturing. No further callbacks will fire after this returns. */
  stop(): void;
}
