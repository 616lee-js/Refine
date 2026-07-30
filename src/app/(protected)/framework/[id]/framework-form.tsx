"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { Toast } from "@/components/ui/toast";
import type { Questionnaire } from "@/lib/questionnaires";

/**
 * Framework mode — one instrument on one page.
 *
 * ── Presented as an instrument, not as a clinical assessment ──────────────────
 * No medical blue, no scored-report styling, no risk banners, and **no severity
 * verdict on this screen**. The bands exist, but showing "moderate" the instant
 * someone finishes answering is a diagnosis in everything but name. The
 * plain-language reading belongs to Mirror, over time, where it can say
 * "moderate · up 4 since 11 Jul" and mean something.
 *
 * ── One page, no auto-advance ─────────────────────────────────────────────────
 * Selecting a radio does not move you on. Being able to see all seven at once,
 * change your mind, and answer roughly is the entire point.
 */

const LABEL_COL = 260;

export function FrameworkForm({
  responseId,
  questionnaire: q,
  initialAnswers,
  initialNote,
  lastTakenAt,
}: {
  responseId: string;
  questionnaire: Questionnaire;
  initialAnswers: Record<string, number>;
  initialNote: string;
  lastTakenAt: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const answeredCount = q.items.filter(
    (i) => typeof answers[i.key] === "number"
  ).length;

  function choose(key: string, value: number) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function finishLater() {
    setBusy(true);
    await fetch(`/api/questionnaires/${responseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, note }),
    });
    router.push("/");
  }

  async function record() {
    setBusy(true);
    try {
      const res = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setToast("Recorded");
      router.push("/");
    } catch {
      setBusy(false);
      setToast("Couldn't record that — your answers are still here");
    }
  }

  return (
    <PageBg>
      <TopNav active="today" />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[22px] sm:px-10">
        <div className="flex w-full flex-col" style={{ maxWidth: 720 }}>
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-5 pb-[14px]">
            <div>
              <Eyebrow accent>
                Framework · {q.shortName}
              </Eyebrow>
              <h1
                className="mb-1 mt-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "27px",
                  fontWeight: 380,
                  letterSpacing: "-0.02em",
                  color: "var(--rf-text)",
                }}
              >
                {q.title}
              </h1>
              <p style={{ fontSize: "13px", color: "var(--rf-text-3)" }}>
                {q.blurb}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {q.cadence && (
                <span
                  className="inline-flex items-center rounded-full font-mono uppercase"
                  style={{
                    padding: "5px 11px",
                    fontSize: "10px",
                    letterSpacing: "0.13em",
                    color: "var(--rf-accent)",
                    background: "var(--rf-accent-soft)",
                  }}
                >
                  {q.cadence}
                </span>
              )}
              {lastTakenAt && (
                <Eyebrow size={9.5}>
                  Last taken{" "}
                  {new Date(lastTakenAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </Eyebrow>
              )}
            </div>
          </div>

          <Sheet className="px-[30px] pb-[18px] pt-[14px]">
            {/* Column labels, stated once. Every row's radios align under them. */}
            <div
              className="hidden gap-[22px] pb-2 sm:grid"
              style={{
                gridTemplateColumns: `1fr ${LABEL_COL}px`,
                borderBottom: "1px solid var(--rf-border)",
              }}
            >
              <Eyebrow size={9.5}>{q.recallWindow}</Eyebrow>
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${q.options.length}, 1fr)` }}
              >
                {q.options.map((o) => (
                  <span
                    key={o.value}
                    className="px-[3px] text-center font-mono uppercase"
                    style={{
                      fontSize: "8.5px",
                      letterSpacing: "0.08em",
                      lineHeight: 1.35,
                      color: "var(--rf-text-4)",
                    }}
                  >
                    {o.label}
                  </span>
                ))}
              </div>
            </div>

            {/* On narrow screens the shared header can't align, so each row
                carries its own labels instead. */}
            <div className="pb-2 sm:hidden">
              <Eyebrow size={9.5}>{q.recallWindow}</Eyebrow>
            </div>

            {q.items.map((item, i) => {
              const selected = answers[item.key];
              return (
                <fieldset
                  key={item.key}
                  className="grid items-center gap-[22px] py-[6px] sm:grid-cols-[1fr_260px]"
                  style={{
                    borderBottom:
                      i === q.items.length - 1
                        ? "none"
                        : "1px solid var(--rf-rule)",
                  }}
                >
                  <legend className="sr-only">{item.text}</legend>
                  <div className="flex gap-3">
                    <span
                      className="w-[14px] shrink-0 pt-1 font-mono"
                      style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "16.5px",
                        lineHeight: 1.45,
                        color: "var(--rf-text)",
                      }}
                    >
                      {item.text}
                    </span>
                  </div>

                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${q.options.length}, 1fr)`,
                    }}
                  >
                    {q.options.map((o) => {
                      const on = selected === o.value;
                      return (
                        <label
                          key={o.value}
                          className="grid cursor-pointer place-items-center py-2"
                        >
                          <input
                            type="radio"
                            name={item.key}
                            value={o.value}
                            checked={on}
                            onChange={() => choose(item.key, o.value)}
                            className="sr-only"
                          />
                          {/* Label repeated for screen readers and narrow
                              screens, where the shared header is hidden. */}
                          <span className="sr-only">{o.label}</span>
                          <span
                            aria-hidden="true"
                            className="grid place-items-center"
                            style={{
                              width: 17,
                              height: 17,
                              borderRadius: "50%",
                              border: `1px solid ${on ? "var(--rf-accent)" : "var(--rf-border-strong)"}`,
                              background: on ? "var(--rf-accent)" : "transparent",
                            }}
                          >
                            {on && (
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 99,
                                  background: "var(--rf-paper)",
                                }}
                              />
                            )}
                          </span>
                          <span
                            className="mt-1 text-center font-mono uppercase sm:hidden"
                            style={{
                              fontSize: "8px",
                              letterSpacing: "0.06em",
                              lineHeight: 1.3,
                              color: on
                                ? "var(--rf-text-2)"
                                : "var(--rf-text-4)",
                            }}
                          >
                            {o.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            {q.allowsNote && (
              <div
                className="mt-[14px] pt-[14px]"
                style={{ borderTop: "1px solid var(--rf-border)" }}
              >
                <label htmlFor="note">
                  <Eyebrow size={9.5}>In your own words · optional</Eyebrow>
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Anything the numbers miss."
                  className="mt-2 w-full resize-none bg-transparent focus:outline-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16.5px",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    color: "var(--rf-text)",
                  }}
                />
              </div>
            )}
          </Sheet>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-5 pb-[18px] pt-[14px]">
            <p
              className="max-w-[380px]"
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--rf-text-4)",
              }}
            >
              Scored and kept in Mirror. You&apos;ll see the trend over time —
              never a diagnosis.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={finishLater}
                disabled={busy}
                className="transition-colors disabled:opacity-40"
                style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
              >
                Finish later
              </button>
              <button
                onClick={record}
                disabled={busy || answeredCount === 0}
                className="rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "var(--rf-text)",
                  color: "var(--rf-paper)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  padding: "9px 18px",
                }}
              >
                {busy ? "Recording…" : "Record answers"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </PageBg>
  );
}
