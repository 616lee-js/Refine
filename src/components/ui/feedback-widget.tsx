"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";

/**
 * In-app bug reports and requests. Present on every authenticated page.
 *
 * ── Why z-30 and not higher ───────────────────────────────────────────────────
 * Deliberately BELOW the two other fixed layers, not above them:
 *
 *   z-50  toast                    must be readable over everything
 *   z-40  footholds overlay        a modal; covering it would be wrong
 *   z-30  this widget
 *
 * A floating button that sits on top of an open dialog is the standard failure
 * of this pattern. Here the overlay covers it, which is what a modal is for.
 * See the z-index scale in docs/refine_design_system.md.
 *
 * The toast is bottom-centre and this is bottom-right, which do not collide on a
 * wide screen but do at 375px — toast.tsx carries `bottom-24 sm:bottom-6` to
 * clear the button vertically on phones.
 */

type FeedbackType = "bug" | "request";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "request", label: "Request" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Sent raw; the server resolves it to a route pattern against an allowlist and
  // stores that, never this string. See src/lib/feedback/pages.ts.
  const pathname = usePathname();

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setBody("");
    setError(null);
  }

  async function submit() {
    if (!body.trim()) {
      setError("Say something first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body, page: pathname }),
      });
      // Checked before closing. A failed submit that closed the panel would
      // throw away what the person wrote while looking like it worked — the
      // same bug class already fixed in Mirror, onboarding, profile and trash.
      if (!res.ok) throw new Error(String(res.status));
      close();
      setToast("Thanks — that's been logged");
    } catch {
      setError("That didn't send. Your text is still here — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 print:hidden">
        {open ? (
          <Sheet
            className="p-[18px]"
            // min() so the panel never exceeds a narrow viewport, and the
            // right/bottom anchor means it expands up and to the left.
            as="section"
          >
            <div
              style={{ width: "min(22rem, calc(100vw - 3rem))" }}
              role="dialog"
              aria-label="Send feedback"
            >
              <div className="flex items-start justify-between gap-4">
                <Eyebrow accent size={9.5}>
                  Send feedback
                </Eyebrow>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close feedback"
                  className="font-mono uppercase"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-4)",
                  }}
                >
                  Close
                </button>
              </div>

              <fieldset className="mt-3">
                <legend className="sr-only">What kind of feedback?</legend>
                <div className="flex gap-2">
                  {TYPES.map((t) => {
                    const on = type === t.value;
                    return (
                      <label
                        key={t.value}
                        className="cursor-pointer rounded-full transition-colors"
                        style={{
                          padding: "6px 13px",
                          fontSize: "12.5px",
                          color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                          background: on ? "var(--rf-text)" : "transparent",
                          boxShadow: on
                            ? "none"
                            : "inset 0 0 0 1px var(--rf-border)",
                        }}
                      >
                        <input
                          type="radio"
                          name="feedback-type"
                          value={t.value}
                          checked={on}
                          onChange={() => setType(t.value)}
                          className="sr-only"
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={
                  type === "bug"
                    ? "What happened, and what were you doing?"
                    : "What would you like it to do?"
                }
                aria-label="Feedback"
                className="mt-3 w-full resize-none rounded-[4px] px-3 py-2 outline-none"
                style={{
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  color: "var(--rf-text)",
                  background: "var(--rf-surface)",
                  boxShadow: "inset 0 0 0 1px var(--rf-border)",
                }}
              />

              {/* Honest mitigation for a plaintext free-text box — see the
                  `feedback` table comment in schema.ts. */}
              <p
                className="mt-2"
                style={{
                  fontSize: "11px",
                  lineHeight: 1.5,
                  color: "var(--rf-text-4)",
                }}
              >
                Not linked to your account. Please keep anything personal out of
                this box — it is stored as written.
              </p>

              {error && (
                <p
                  aria-live="polite"
                  className="mt-2"
                  style={{
                    fontSize: "11.5px",
                    lineHeight: 1.5,
                    color: "var(--color-error)",
                  }}
                >
                  {error}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="rounded-full transition-colors disabled:opacity-40"
                  style={{
                    padding: "8px 16px",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    background: "var(--rf-text)",
                    color: "var(--rf-paper)",
                  }}
                >
                  {busy ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="font-mono uppercase"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-3)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Sheet>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            className="flex items-center gap-[7px] rounded-full transition-colors"
            style={{
              padding: "9px 15px",
              fontSize: "12.5px",
              color: "var(--rf-text-2)",
              background: "var(--rf-paper)",
              border: "1px solid var(--rf-paper-edge)",
              boxShadow: "var(--rf-sheet-shadow)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 8.5a1.5 1.5 0 0 1-1.5 1.5H4l-3 2.5V3a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 12 3z" />
            </svg>
            Feedback
          </button>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
