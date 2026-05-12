"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useVoiceSession,
  type VoiceTriggerPayload,
} from "./use-voice-session";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };
type Mode = "text" | "voice";

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageItem({
  message,
  showCursor,
}: {
  message: Message;
  showCursor: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-stone-100 text-stone-800 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-sm text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-prose text-sm text-stone-700 leading-[1.8] whitespace-pre-wrap">
      {message.content}
      {showCursor && (
        <span
          aria-hidden="true"
          className="inline-block w-0.5 h-[1em] ml-0.5 bg-stone-400 animate-pulse align-middle"
        />
      )}
    </div>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="pt-24 text-center">
      <p className="text-sm text-stone-400 leading-loose">
        {mode === "voice" ? (
          <>
            This is your space to reflect.
            <br />
            Speak whenever you are ready.
          </>
        ) : (
          <>
            This is your space to reflect.
            <br />
            Write whatever is on your mind.
          </>
        )}
      </p>
    </div>
  );
}

function CrisisLine() {
  return (
    <p className="mt-4 text-xs text-stone-400 text-center leading-relaxed">
      In crisis?{" "}
      <strong className="font-medium text-stone-500">Call or text 988</strong>
      <span aria-hidden="true"> · </span>
      <strong className="font-medium text-stone-500">Text HOME to 741741</strong>
    </p>
  );
}

// ── Voice UI ──────────────────────────────────────────────────────────────────

const CADENCE_OPTIONS: { label: string; value: 0 | 10 | 20 | 30 }[] = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10 },
  { label: "20s", value: 20 },
  { label: "30s", value: 30 },
];

function VoiceIndicator({
  status,
}: {
  status: "listening" | "restarting" | "triggering";
}) {
  const label =
    status === "restarting"
      ? "Restarting microphone…"
      : status === "triggering"
      ? "Sending…"
      : "Listening";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "restarting" || status === "triggering"
            ? "bg-stone-300"
            : "bg-red-400 animate-pulse"
        }`}
        aria-hidden="true"
      />
      <span className="text-xs text-stone-400">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Chat({
  reflectionId,
  initialCadence,
  initialEnded = false,
}: {
  reflectionId: string;
  initialCadence: 0 | 10 | 20 | 30;
  initialEnded?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ended, setEnded] = useState(initialEnded);
  const [mode, setMode] = useState<Mode>("text");
  const [cadence, setCadence] = useState<0 | 10 | 20 | 30>(initialCadence);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Abandon beacon — fires on in-app navigation (component unmount)
  useEffect(() => {
    return () => {
      navigator.sendBeacon(`/api/reflections/${reflectionId}/abandon`);
    };
  }, [reflectionId]);

  // Abandon beacon — fires on tab/window close
  useEffect(() => {
    const handler = () =>
      navigator.sendBeacon(`/api/reflections/${reflectionId}/abandon`);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [reflectionId]);

  // ── Shared send logic ─────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: {
        source?: "user_voice";
        precomputedTier?: 0 | 1 | 2 | 3;
        audioRef?: string;
        voiceSummary?: VoiceTriggerPayload["voiceSummary"];
      }
    ) => {
      if (!text || streaming) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ]);
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            reflectionId,
            ...(opts?.source && { source: opts.source }),
            ...(opts?.precomputedTier !== undefined && {
              precomputedTier: opts.precomputedTier,
            }),
            ...(opts?.audioRef && { audioRef: opts.audioRef }),
            ...(opts?.voiceSummary && { voiceSummary: opts.voiceSummary }),
          }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + chunk,
            };
            return next;
          });
        }
      } catch {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "Something went wrong. Please try again.",
          };
          return next;
        });
      } finally {
        setStreaming(false);
      }
    },
    [reflectionId, streaming]
  );

  // ── Voice session hook ────────────────────────────────────────────────────

  const handleVoiceTrigger = useCallback(
    (payload: VoiceTriggerPayload) => {
      setVoiceError(null);
      sendMessage(payload.message, {
        source: "user_voice",
        precomputedTier: payload.precomputedTier,
        audioRef: payload.audioRef,
        voiceSummary: payload.voiceSummary,
      });
    },
    [sendMessage]
  );

  const voice = useVoiceSession({
    reflectionId,
    cadence,
    onTrigger: handleVoiceTrigger,
    onError: (err) => setVoiceError(err.message),
  });

  // ── Mode switching ────────────────────────────────────────────────────────

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (mode === "voice" && voice.status !== "idle") {
      voice.cancel();
    }
    setVoiceError(null);
    setMode(next);
  }

  // ── Text input handlers ───────────────────────────────────────────────────

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  // ── End session ───────────────────────────────────────────────────────────

  async function handleEndSession() {
    if (streaming || ended) return;
    if (mode === "voice" && voice.status !== "idle") voice.cancel();

    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/reflections/${reflectionId}/end`, {
        method: "POST",
      });
      if (res.status === 204) {
        router.push("/");
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }
      setEnded(true);
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong ending the session.",
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  // ── Cancel session ───────────────────────────────────────────────────────

  async function handleCancelSession() {
    if (streaming || ended) return;
    if (mode === "voice" && voice.status !== "idle") voice.cancel();
    await fetch(`/api/reflections/${reflectionId}/cancel`, { method: "POST" });
    router.push("/");
  }

  // ── Cadence change ────────────────────────────────────────────────────────

  function handleCadenceChange(value: 0 | 10 | 20 | 30) {
    setCadence(value);
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceCadence: value }),
    }).catch(() => {});
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isVoiceActive =
    mode === "voice" &&
    (voice.status === "listening" ||
      voice.status === "restarting" ||
      voice.status === "triggering");

  return (
    <div className="flex flex-col h-screen bg-white text-stone-800">
      {/* ── Header ── */}
      <header className="shrink-0 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine
        </h1>
        <div className="flex items-center gap-4">
          <a
            href="/reflections"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Reflections
          </a>
          <a
            href="/memory"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Mirror
          </a>
          <a
            href="/settings/profile"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Profile
          </a>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Message list ── */}
      <main
        className="flex-1 overflow-y-auto"
        aria-label="Conversation"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="max-w-2xl mx-auto px-6 py-10">
          {messages.length === 0 ? (
            <EmptyState mode={mode} />
          ) : (
            <ol className="space-y-8">
              {messages.map((msg, i) => {
                const isLastAssistant =
                  streaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant";
                return (
                  <li key={i}>
                    <MessageItem message={msg} showCursor={isLastAssistant} />
                  </li>
                );
              })}
            </ol>
          )}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </main>

      {/* ── Input area ── */}
      <footer className="shrink-0 border-t border-stone-100 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-5">
          {ended ? (
            <p className="text-xs text-stone-400 text-center py-2">
              Reflection ended.
            </p>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex gap-1 mb-4">
                {(["text", "voice"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      mode === m
                        ? "bg-stone-800 text-white"
                        : "text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    {m === "text" ? "Text" : "Voice"}
                  </button>
                ))}
              </div>

              {/* Text mode */}
              {mode === "text" && (
                <form onSubmit={handleSubmit} noValidate>
                  <label htmlFor="message-input" className="sr-only">
                    Your message
                  </label>
                  <div className="flex gap-3 items-end">
                    <textarea
                      ref={textareaRef}
                      id="message-input"
                      name="message"
                      value={input}
                      rows={2}
                      placeholder="Write here…"
                      disabled={streaming}
                      onChange={(e) => {
                        setInput(e.target.value);
                        autoResize();
                      }}
                      onKeyDown={onKeyDown}
                      className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white disabled:opacity-50 leading-relaxed transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || streaming}
                      aria-label="Send message"
                      className="shrink-0 h-[46px] px-5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </form>
              )}

              {/* Voice mode */}
              {mode === "voice" && (
                <div className="space-y-3">
                  {/* Status indicator */}
                  {isVoiceActive && (
                    <VoiceIndicator status={voice.status as "listening" | "restarting" | "triggering"} />
                  )}

                  {/* Utterance buffer */}
                  {voice.utteranceBuffer.length > 0 && (
                    <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700 leading-relaxed">
                      {voice.utteranceBuffer.join(" ")}
                    </div>
                  )}

                  {/* Interim text */}
                  {voice.interimText && (
                    <p className="text-sm text-stone-400 italic px-1">
                      {voice.interimText}
                    </p>
                  )}

                  {/* Pause countdown */}
                  {voice.pauseSecondsLeft !== null && voice.pauseSecondsLeft > 0 && (
                    <p className="text-xs text-stone-400">
                      Sending in {voice.pauseSecondsLeft}s…
                    </p>
                  )}

                  {/* Voice error */}
                  {voiceError && (
                    <p className="text-xs text-red-600">{voiceError}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {voice.status === "idle" && !streaming && (
                      <button
                        type="button"
                        onClick={() => voice.start()}
                        className="px-4 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
                      >
                        Start speaking
                      </button>
                    )}

                    {isVoiceActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => voice.trigger()}
                          disabled={
                            voice.utteranceBuffer.length === 0 ||
                            voice.status === "triggering"
                          }
                          className="px-4 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          I&apos;m done
                        </button>
                        <button
                          type="button"
                          onClick={() => voice.cancel()}
                          disabled={voice.status === "triggering"}
                          className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>

                  {/* Cadence picker */}
                  {!streaming && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-stone-400">Auto-send:</span>
                      {CADENCE_OPTIONS.map(({ label, value }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleCadenceChange(value)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            cadence === value
                              ? "bg-stone-200 text-stone-700 font-medium"
                              : "text-stone-400 hover:text-stone-600"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* End / Cancel session */}
              <div className="mt-3 text-center space-y-1">
                {cancelConfirm ? (
                  <p className="text-xs text-stone-500">
                    Discard this reflection? Nothing will be saved.{" "}
                    <button
                      type="button"
                      onClick={handleCancelSession}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      Discard
                    </button>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setCancelConfirm(false)}
                      className="text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Keep going
                    </button>
                  </p>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={handleEndSession}
                      disabled={streaming}
                      className="text-xs text-stone-400 hover:text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      End reflection
                    </button>
                    <span className="text-stone-200" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setCancelConfirm(true)}
                      disabled={streaming}
                      className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <CrisisLine />
        </div>
      </footer>
    </div>
  );
}
