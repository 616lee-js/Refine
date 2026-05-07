"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

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

function EmptyState() {
  return (
    <div className="pt-24 text-center">
      <p className="text-sm text-stone-400 leading-loose">
        This is your space to reflect.
        <br />
        Write whatever is on your mind.
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

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
        body: JSON.stringify({ message: text }),
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
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Delegate to the form's submit handler to keep logic in one place
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white text-stone-800">
      {/* ── Header ── */}
      <header className="shrink-0 px-6 py-4 border-b border-stone-100">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine
        </h1>
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
            <EmptyState />
          ) : (
            <ol className="space-y-8">
              {messages.map((msg, i) => {
                const isLastAssistant =
                  streaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant";
                return (
                  <li key={i}>
                    <MessageItem
                      message={msg}
                      showCursor={isLastAssistant}
                    />
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

          <CrisisLine />
        </div>
      </footer>
    </div>
  );
}
