import type { TranscriptionCallbacks, TranscriptionProvider } from "./types";

export class WebSpeechProvider implements TranscriptionProvider {
  private recognition: SpeechRecognition | null = null;
  private callbacks: TranscriptionCallbacks | null = null;
  private active = false;

  start(callbacks: TranscriptionCallbacks): void {
    const SR =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
            .webkitSpeechRecognition)) ||
      null;

    if (!SR) {
      callbacks.onError(new Error("SpeechRecognition not supported in this browser"));
      return;
    }

    this.callbacks = callbacks;
    this.active = true;
    this.attach(SR);
  }

  stop(): void {
    this.active = false;
    this.callbacks = null;
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }
  }

  private attach(SR: typeof SpeechRecognition): void {
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.callbacks) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          this.callbacks.onUtterance(text);
        } else {
          this.callbacks.onInterim(text);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!this.callbacks) return;
      // "no-speech" is non-fatal — recognition will auto-stop then restart
      if (event.error === "no-speech") return;
      this.callbacks.onError(new Error(`SpeechRecognition error: ${event.error}`));
    };

    rec.onend = () => {
      if (!this.active || !this.callbacks) return;
      // Auto-restart on unexpected stop
      this.callbacks.onRestart();
      this.attach(SR);
    };

    this.recognition = rec;
    rec.start();
  }
}
