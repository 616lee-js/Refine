"use client";

import { useRef, useState, useCallback } from "react";
import { WebSpeechProvider } from "@/lib/transcription/web-speech";
import { VOICE_ENABLED } from "@/lib/flags";
import type { Tier } from "@/lib/orchestrator";

export type VoiceTriggerPayload = {
  message: string;
  precomputedTier: Tier;
  audioRef?: string;
  voiceSummary: {
    triggerType: "pause" | "manual";
    utteranceTiers: number[];
    maxTier: number;
  };
};

type UseVoiceSessionOptions = {
  reflectionId: string;
  cadence: 0 | 10 | 20 | 30;
  onTrigger: (payload: VoiceTriggerPayload) => void;
  onError: (err: Error) => void;
};

function addPunctuation(text: string): string {
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : capitalized + ".";
}

export type VoiceStatus =
  | "idle"
  | "listening"
  | "restarting"
  | "triggering";

export function useVoiceSession({
  reflectionId,
  cadence,
  onTrigger,
  onError,
}: UseVoiceSessionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [utteranceBuffer, setUtteranceBuffer] = useState<string[]>([]);
  const [pauseSecondsLeft, setPauseSecondsLeft] = useState<number | null>(null);

  const providerRef = useRef<WebSpeechProvider | null>(null);
  const utteranceIndexRef = useRef(0);
  const utteranceTiersRef = useRef<number[]>([]);
  const maxTierRef = useRef<Tier>(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef<string[]>([]);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    pauseTimerRef.current = null;
    countdownTimerRef.current = null;
    setPauseSecondsLeft(null);
  }, []);

  const doTrigger = useCallback(
    async (triggerType: "pause" | "manual") => {
      clearPauseTimer();
      setStatus("triggering");

      const message = bufferRef.current.join(" ").trim();
      if (!message) {
        setStatus("listening");
        return;
      }

      // Stop recognition
      if (providerRef.current) {
        providerRef.current.stop();
        providerRef.current = null;
      }

      // Audio upload removed — see the note in start(). `audioRef` stays
      // undefined, so entries.raw_audio_ref is written null.
      const audioRef: string | undefined = undefined;

      const precomputedTier = maxTierRef.current;
      const utteranceTiers = [...utteranceTiersRef.current];

      // Reset state
      bufferRef.current = [];
      utteranceTiersRef.current = [];
      maxTierRef.current = 0;
      utteranceIndexRef.current = 0;
      setUtteranceBuffer([]);
      setInterimText("");
      setStatus("idle");

      onTrigger({
        message,
        precomputedTier,
        audioRef,
        voiceSummary: { triggerType, utteranceTiers, maxTier: precomputedTier },
      });
    },
    [clearPauseTimer, reflectionId, onTrigger]
  );

  const startPauseTimer = useCallback(
    (seconds: number) => {
      clearPauseTimer();
      let remaining = seconds;
      setPauseSecondsLeft(remaining);

      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        setPauseSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
        }
      }, 1000);

      pauseTimerRef.current = setTimeout(() => {
        doTrigger("pause");
      }, seconds * 1000);
    },
    [clearPauseTimer, doTrigger]
  );

  const start = useCallback(async () => {
    if (status !== "idle") return;

    // Belt-and-braces: the UI renders no voice controls while the flag is off,
    // so this should be unreachable. Guarding here means the Web Speech API is
    // never constructed even if some future call site forgets to check.
    if (!VOICE_ENABLED) return;

    // ── Audio capture removed for the serverless deployment ──────────────────
    // v1 opened a MediaRecorder here and POSTed the blob to
    // /api/reflections/[id]/audio, which wrote it to ./audio/. Vercel has no
    // persistent filesystem, so that path is gone. (The server route it posted
    // to had in fact never existed — .gitignore's unanchored `audio/` pattern
    // swallowed the file before it was ever committed, and the client silently
    // ignored the resulting 404.)
    //
    // Cloud audio storage reattaches here: capture the stream, upload to object
    // storage, and pass the returned reference through as `audioRef` in
    // doTrigger(). Everything downstream of that already handles it.

    bufferRef.current = [];
    utteranceTiersRef.current = [];
    maxTierRef.current = 0;
    utteranceIndexRef.current = 0;
    setUtteranceBuffer([]);
    setInterimText("");
    setStatus("listening");

    const provider = new WebSpeechProvider();
    providerRef.current = provider;

    provider.start({
      onInterim(text) {
        setInterimText(text);
        if (text) clearPauseTimer();
      },

      onUtterance(text) {
        setInterimText("");
        const trimmed = addPunctuation(text.trim());
        if (!trimmed) return;

        const idx = utteranceIndexRef.current++;
        bufferRef.current = [...bufferRef.current, trimmed];
        setUtteranceBuffer([...bufferRef.current]);

        // Per-utterance classify (fire-and-forget; update tier state when done)
        fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflectionId, text: trimmed, utteranceIndex: idx }),
        })
          .then((r) => r.json())
          .then((data: { tier: number }) => {
            utteranceTiersRef.current.push(data.tier);
            if (data.tier > maxTierRef.current) {
              maxTierRef.current = data.tier as Tier;
            }
          })
          .catch(() => {
            // classify failure: push 1 (fail-safe)
            utteranceTiersRef.current.push(1);
            if (1 > maxTierRef.current) maxTierRef.current = 1;
          });

        if (cadence > 0) startPauseTimer(cadence);
      },

      onRestart() {
        setStatus("restarting");
        setTimeout(() => setStatus("listening"), 1500);
      },

      onError(err) {
        setStatus("idle");
        onError(err);
      },
    });
  }, [status, reflectionId, cadence, startPauseTimer, onError]);

  const trigger = useCallback(() => {
    doTrigger("manual");
  }, [doTrigger]);

  const cancel = useCallback(async () => {
    clearPauseTimer();
    if (providerRef.current) {
      providerRef.current.stop();
      providerRef.current = null;
    }

    bufferRef.current = [];
    utteranceTiersRef.current = [];
    maxTierRef.current = 0;
    utteranceIndexRef.current = 0;
    setUtteranceBuffer([]);
    setInterimText("");
    setStatus("idle");

    // Delete pending utterance safetyLog rows
    fetch(`/api/reflections/${reflectionId}/cancel-utterance`, { method: "POST" }).catch(
      () => {}
    );
  }, [clearPauseTimer, reflectionId]);

  return {
    status,
    interimText,
    utteranceBuffer,
    pauseSecondsLeft,
    start,
    trigger,
    cancel,
  };
}
