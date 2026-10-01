"use client";

import { useState } from "react";
import type { Dictation } from "@/app/(protected)/use-dictation";

/**
 * Speak instead of typing.
 *
 * ── It asks before the first time, once ───────────────────────────────────────
 * Chrome does not transcribe on the device — it streams the audio to Google. That
 * is a real exposure for a journal, recorded as LIM-005, and someone pressing a
 * microphone has no way of knowing it. So the first press explains and waits; only
 * the confirmation starts the microphone. After that, this device remembers and
 * the button works in one press.
 *
 * Remembered per browser rather than on the account: it is about what a device
 * does with sound, and the same person on a different machine deserves the notice
 * again. `localStorage` can throw where site data is blocked, so every access is
 * guarded and a failure just means the notice shows again.
 *
 * ── The state is always visible ───────────────────────────────────────────────
 * Listening, restarting, and whatever has been heard but not yet committed are
 * all on screen. The microphone stops itself after a pause and words spoken in
 * the gap are lost (LIM-012); hiding that would make the loss look like bad
 * transcription.
 */

const CONSENT_KEY = "rf_dictation_ack";

// COPY REVIEW: placeholders pending final wording. The notice text is not
// decoration — it is the only place the person is told where the audio goes.
const COPY = {
  speak: "[COPY] Speak",
  stop: "[COPY] Stop",
  listening: "[COPY] Listening",
  restarting: "[COPY] Microphone restarting — words said just now may be lost",
  failed: "[COPY] The microphone stopped working. Your writing is untouched.",

  noticeTitle: "[COPY] Before you start speaking",
  noticeBody:
    "[COPY] Your browser does not turn speech into text on this device — it sends the audio to Google to do it. Nothing is saved as a recording, by Refine or anywhere in this app, and only the words appear in your entry. But the sound of your voice does leave this machine, so this is worth deciding once rather than assuming.",
  noticeConfirm: "[COPY] I understand — start the microphone",
  noticeCancel: "[COPY] Not now",
} as const;

export function DictationButton({ dictation }: { dictation: Dictation }) {
  const { supported, listening, interim, restarting, failed, start, stop } =
    dictation;
  const [asking, setAsking] = useState(false);

  // Nothing renders on a browser without speech recognition, and nothing renders
  // on the server — `supported` is false until mounted. See use-dictation.ts.
  if (!supported) return null;

  function acknowledged(): boolean {
    try {
      return localStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      // Blocked or unavailable: treat as not yet told, which shows the notice
      // again rather than starting a microphone on an unexplained press.
      return false;
    }
  }

  function press() {
    if (listening) {
      stop();
      return;
    }
    if (acknowledged()) {
      start();
      return;
    }
    setAsking(true);
  }

  function confirm() {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // The microphone still starts; the notice simply returns next time.
    }
    setAsking(false);
    start();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={press}
          aria-pressed={listening}
          className="inline-flex items-center gap-[7px] rounded-full transition-colors"
          style={{
            padding: "7px 14px",
            fontSize: "12.5px",
            color: listening ? "var(--rf-paper)" : "var(--rf-text-2)",
            background: listening ? "var(--rf-accent)" : "transparent",
            boxShadow: listening
              ? "none"
              : "inset 0 0 0 1px var(--rf-border-strong)",
          }}
        >
          {/* A microphone, drawn rather than imported — the project carries no
              icon dependency. */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="5" y="1.5" width="4" height="7" rx="2" />
            <path d="M3 7a4 4 0 0 0 8 0" />
            <path d="M7 11v1.5" />
          </svg>
          {listening ? COPY.stop : COPY.speak}
        </button>

        {listening && (
          <span
            aria-live="polite"
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: restarting ? "var(--color-error)" : "var(--rf-text-4)",
            }}
          >
            {restarting ? COPY.restarting : COPY.listening}
          </span>
        )}

        {failed && (
          <span style={{ fontSize: "11.5px", color: "var(--color-error)" }}>
            {COPY.failed}
          </span>
        )}
      </div>

      {/* Heard, not yet placed in the entry. Shown so speaking does not feel like
          talking into nothing while the browser decides a sentence has ended. */}
      {listening && interim && (
        <p
          aria-live="polite"
          style={{
            fontSize: "12.5px",
            lineHeight: 1.5,
            color: "var(--rf-text-4)",
            fontStyle: "italic",
          }}
        >
          {interim}
        </p>
      )}

      {asking && (
        <div
          role="group"
          aria-label={COPY.noticeTitle}
          className="rounded-[4px] px-4 py-3"
          style={{
            background: "var(--rf-surface)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        >
          <p
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-3)",
            }}
          >
            {COPY.noticeTitle}
          </p>
          <p
            className="mt-2 max-w-[520px]"
            style={{
              fontSize: "12.5px",
              lineHeight: 1.6,
              color: "var(--rf-text-2)",
            }}
          >
            {COPY.noticeBody}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              className="rounded-full transition-colors"
              style={{
                padding: "7px 14px",
                fontSize: "12.5px",
                fontWeight: 500,
                background: "var(--rf-text)",
                color: "var(--rf-paper)",
              }}
            >
              {COPY.noticeConfirm}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
            >
              {COPY.noticeCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
