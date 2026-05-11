"use client";

import { useRef, useState, useCallback } from "react";
import { WebSpeechProvider } from "@/lib/transcription/web-speech";
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
  sessionId: string;
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
  sessionId,
  cadence,
  onTrigger,
  onError,
}: UseVoiceSessionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [utteranceBuffer, setUtteranceBuffer] = useState<string[]>([]);
  const [pauseSecondsLeft, setPauseSecondsLeft] = useState<number | null>(null);

  const providerRef = useRef<WebSpeechProvider | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
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

      // Stop MediaRecorder and collect audio
      let audioRef: string | undefined;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          const mr = mediaRecorderRef.current!;
          mr.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            try {
              const res = await fetch(`/api/sessions/${sessionId}/audio`, {
                method: "POST",
                body: blob,
                headers: { "Content-Type": "audio/webm" },
              });
              if (res.ok) {
                const data = (await res.json()) as { audioRef: string };
                audioRef = data.audioRef;
              }
            } catch {
              // non-fatal; audioRef stays undefined
            }
            resolve();
          };
          mr.stop();
        });
      }

      const precomputedTier = maxTierRef.current;
      const utteranceTiers = [...utteranceTiersRef.current];

      // Reset state
      bufferRef.current = [];
      utteranceTiersRef.current = [];
      maxTierRef.current = 0;
      utteranceIndexRef.current = 0;
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
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
    [clearPauseTimer, sessionId, onTrigger]
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

    // Request mic for audio recording
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Audio recording unavailable; voice still works without audio saving
    }

    if (stream) {
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.start(250); // collect in 250ms chunks
      mediaRecorderRef.current = mr;
    }

    bufferRef.current = [];
    utteranceTiersRef.current = [];
    maxTierRef.current = 0;
    utteranceIndexRef.current = 0;
    audioChunksRef.current = [];
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
          body: JSON.stringify({ sessionId, text: trimmed, utteranceIndex: idx }),
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
  }, [status, sessionId, cadence, startPauseTimer, onError]);

  const trigger = useCallback(() => {
    doTrigger("manual");
  }, [doTrigger]);

  const cancel = useCallback(async () => {
    clearPauseTimer();
    if (providerRef.current) {
      providerRef.current.stop();
      providerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    bufferRef.current = [];
    utteranceTiersRef.current = [];
    maxTierRef.current = 0;
    utteranceIndexRef.current = 0;
    audioChunksRef.current = [];
    setUtteranceBuffer([]);
    setInterimText("");
    setStatus("idle");

    // Delete pending utterance safetyLog rows
    fetch(`/api/sessions/${sessionId}/cancel-utterance`, { method: "POST" }).catch(
      () => {}
    );
  }, [clearPauseTimer, sessionId]);

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
