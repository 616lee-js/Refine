"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WebSpeechProvider } from "@/lib/transcription/web-speech";
import type { TranscriptionProvider } from "@/lib/transcription/types";

/**
 * Speaking instead of typing, into the writing surface.
 *
 * ── What this is not ──────────────────────────────────────────────────────────
 * Not the voice mode that was archived. That one accumulated utterances and used
 * a pause timer to decide when to *send* them to a model for a reply, which is a
 * conversation's shape. A journal entry has no send and no reply: words arrive in
 * the box and that is the whole feature. It also saved `.webm` blobs to disk,
 * which does not work on a server with no persistent disk — see src/lib/flags.ts.
 *
 * **Nothing is recorded.** No MediaRecorder, no blob, no upload, no file. Only
 * text reaches this hook, and the only place it goes is the textarea.
 *
 * ── The audio does leave the machine, and that is worth saying out loud ───────
 * Chrome's SpeechRecognition does not transcribe locally — it streams audio to
 * Google. For a journal holding this kind of writing that is a real exposure, and
 * it is on record as LIM-005. The caller is responsible for saying so on screen
 * before the first use; this hook will not transcribe anything until it is asked
 * to, so the consent point is the button.
 *
 * ── Support is detected after mount, never during render ──────────────────────
 * `window.SpeechRecognition` cannot be read while rendering: the server has no
 * window, so a control rendered conditionally on it exists in the browser and not
 * in the server's HTML, and React fails the hydration with the same error that
 * took the check-in page down (#418). `supported` therefore starts false
 * everywhere and is raised in an effect, so the first client render matches the
 * server's and the button appears a frame later.
 *
 * ── The microphone stops on its own ───────────────────────────────────────────
 * The browser ends recognition after a pause or a network blip. The provider
 * restarts itself, but words spoken in the gap are lost — LIM-012 — so
 * `restarting` exists to be shown rather than hidden.
 */

export type Dictation = {
  /** False until mounted, and on any browser without SpeechRecognition. */
  supported: boolean;
  listening: boolean;
  /** Words still being recognised. Not yet committed to the entry. */
  interim: string;
  /** The microphone dropped and is coming back. Words in the gap are lost. */
  restarting: boolean;
  /** Set when recognition failed for a reason it cannot recover from. */
  failed: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

export function useDictation({
  onText,
}: {
  /** A finished utterance, to be put into the entry wherever the caret is. */
  onText: (chunk: string) => void;
}): Dictation {
  const providerRef = useRef<TranscriptionProvider | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * The provider's callbacks are registered once, at start(), and live for as
   * long as the microphone does. Reading `onText` through a ref means a re-render
   * between utterances cannot leave them writing into a stale copy of the entry.
   */
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    const SR =
      window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
    if (SR) setSupported(true);
  }, []);

  const stop = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    setListening(false);
    setInterim("");
    setRestarting(false);
  }, []);

  const start = useCallback(() => {
    if (providerRef.current) return;
    setFailed(false);
    setRestarting(false);

    const provider = new WebSpeechProvider();
    providerRef.current = provider;
    setListening(true);

    provider.start({
      onInterim: (t) => {
        setRestarting(false);
        setInterim(t);
      },
      onUtterance: (t) => {
        setRestarting(false);
        setInterim("");
        const chunk = t.trim();
        if (chunk) onTextRef.current(chunk);
      },
      onRestart: () => {
        setRestarting(true);
        setInterim("");
      },
      onError: () => {
        // Unrecoverable: the provider is already finished, so this tears down
        // rather than leaving a dead microphone looking live.
        setFailed(true);
        providerRef.current?.stop();
        providerRef.current = null;
        setListening(false);
        setInterim("");
        setRestarting(false);
      },
    });
  }, []);

  const toggle = useCallback(() => {
    if (providerRef.current) stop();
    else start();
  }, [start, stop]);

  // Leaving the page with the microphone open would keep it open.
  useEffect(() => stop, [stop]);

  return { supported, listening, interim, restarting, failed, start, stop, toggle };
}
