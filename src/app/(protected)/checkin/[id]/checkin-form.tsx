"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { Toast } from "@/components/ui/toast";
import type {
  Answers,
  TrackerQuestionnaire,
  TrackerField,
} from "@/lib/questionnaires";

/**
 * The daily check-in — the tracker renderer.
 *
 * Four taps, then out. It is deliberately the fastest surface in the product:
 * anything that makes it feel like a form is a reason not to do it tomorrow.
 *
 * ── No streaks ────────────────────────────────────────────────────────────────
 * `loggedRecently` is a count of what happened, shown only once there is enough
 * history for it to read as a record rather than a scoreboard. Early on — when
 * "1 of the last 21 days" would land as failure — it is simply absent. Nothing
 * here congratulates, warns, or notices a gap.
 */

function FieldRow({
  field,
  children,
  last,
}: {
  field: TrackerField;
  children: React.ReactNode;
  last: boolean;
}) {
  return (
    <div
      className="grid items-center gap-6 py-[15px] sm:grid-cols-[150px_1fr]"
      style={{ borderBottom: last ? "none" : "1px solid var(--rf-rule)" }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "16.5px",
            color: "var(--rf-text)",
          }}
        >
          {field.label}
        </p>
        {field.note && (
          <p
            className="mt-0.5"
            style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
          >
            {field.note}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function CheckinForm({
  responseId,
  admin,

  questionnaire: q,
  initialAnswers,
  loggedRecently,
  today,
}: {
  responseId: string;
  /** Rendered admin entry points from the server parent — see admin-nav.tsx. */
  admin: React.ReactNode;

  questionnaire: TrackerQuestionnaire;
  initialAnswers: Answers;
  /** Days logged out of the last 21, or null when there isn't enough history. */
  loggedRecently: number | null;
  today: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function setValue(key: string, value: Answers[string]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function log(thenWrite: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error(String(res.status));

      if (thenWrite) {
        const entry = await fetch("/api/reflections", { method: "POST" });
        if (entry.ok) {
          const { reflectionId } = (await entry.json()) as {
            reflectionId: string;
          };
          router.push(`/reflection/${reflectionId}`);
          return;
        }
      }
      router.push("/");
    } catch {
      setBusy(false);
      setToast("Couldn't log that — your answers are still here");
    }
  }

  return (
    <PageBg>
      <TopNav active="today" admin={admin} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[22px] sm:px-10">
        <div className="flex w-full flex-col" style={{ maxWidth: 660 }}>
          <div className="flex flex-wrap items-end justify-between gap-5 pb-[14px]">
            <div>
              <Eyebrow accent>Daily check-in</Eyebrow>
              <h1
                className="mb-1 mt-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "30px",
                  fontWeight: 380,
                  letterSpacing: "-0.02em",
                  color: "var(--rf-text)",
                }}
              >
                {today}
              </h1>
              <p style={{ fontSize: "13px", color: "var(--rf-text-3)" }}>
                {q.blurb}
              </p>
            </div>
            {loggedRecently !== null && (
              <Eyebrow size={9.5}>
                {loggedRecently} of the last 21 days logged
              </Eyebrow>
            )}
          </div>

          <Sheet className="px-[30px] pb-[18px] pt-[6px]">
            {q.fields.map((field, i) => {
              const last = i === q.fields.length - 1;

              if (field.kind === "count") {
                const v =
                  typeof answers[field.key] === "number"
                    ? (answers[field.key] as number)
                    : null;
                const step = (delta: number) => {
                  const base = v ?? 7;
                  const next = Math.min(
                    field.max,
                    Math.max(field.min, base + delta * field.step)
                  );
                  setValue(field.key, Math.round(next * 2) / 2);
                };
                return (
                  <FieldRow key={field.key} field={field} last={last}>
                    <div className="flex items-center gap-4">
                      <span
                        aria-live="polite"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "26px",
                          color: v === null ? "var(--rf-text-4)" : "var(--rf-text)",
                          minWidth: "3.2rem",
                        }}
                      >
                        {v === null ? "—" : `${v}${field.unit ?? ""}`}
                      </span>
                      <div className="flex gap-2">
                        {[-1, 1].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => step(d)}
                            aria-label={`${d < 0 ? "Less" : "More"} ${field.label.toLowerCase()}`}
                            className="grid place-items-center transition-colors"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                              color: "var(--rf-text-2)",
                              fontSize: "14px",
                            }}
                          >
                            {d < 0 ? "−" : "+"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </FieldRow>
                );
              }

              if (field.kind === "scale") {
                const v = answers[field.key] as number | undefined;
                return (
                  <FieldRow key={field.key} field={field} last={last}>
                    <fieldset>
                      <legend className="sr-only">{field.label}</legend>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          {Array.from({ length: field.steps }).map((_, i) => {
                            const val = i + 1;
                            const on = v === val;
                            return (
                              <label
                                key={val}
                                className="grid cursor-pointer place-items-center font-mono"
                                style={{
                                  width: 34,
                                  height: 30,
                                  borderRadius: 4,
                                  fontSize: "11px",
                                  background: on
                                    ? "var(--rf-accent)"
                                    : "transparent",
                                  boxShadow: on
                                    ? "none"
                                    : "inset 0 0 0 1px var(--rf-border)",
                                  color: on
                                    ? "var(--rf-paper)"
                                    : "var(--rf-text-3)",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={field.key}
                                  value={val}
                                  checked={on}
                                  onChange={() => setValue(field.key, val)}
                                  className="sr-only"
                                />
                                {val}
                              </label>
                            );
                          })}
                        </div>
                        <div
                          className="flex justify-between"
                          style={{ width: 34 * field.steps + 6 * (field.steps - 1) }}
                        >
                          {field.endLabels.map((l) => (
                            <Eyebrow key={l} size={9}>
                              {l}
                            </Eyebrow>
                          ))}
                        </div>
                      </div>
                    </fieldset>
                  </FieldRow>
                );
              }

              const picked = (answers[field.key] as Record<string, boolean>) ?? {};
              return (
                <FieldRow key={field.key} field={field} last={last}>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((o) => {
                      const on = picked[o.key] === true;
                      return (
                        <label
                          key={o.key}
                          className="inline-flex cursor-pointer items-center gap-[7px] transition-colors"
                          style={{
                            padding: "7px 13px",
                            borderRadius: 999,
                            fontSize: "12.5px",
                            background: on
                              ? "var(--rf-accent-2-soft)"
                              : "transparent",
                            boxShadow: on
                              ? "inset 0 0 0 1px var(--rf-accent-2)"
                              : "inset 0 0 0 1px var(--rf-border)",
                            color: on ? "var(--rf-text)" : "var(--rf-text-3)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setValue(field.key, {
                                ...picked,
                                [o.key]: e.target.checked,
                              })
                            }
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className="grid place-items-center"
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: 3,
                              background: on
                                ? "var(--rf-accent-2)"
                                : "transparent",
                              boxShadow: on
                                ? "none"
                                : "inset 0 0 0 1px var(--rf-border-strong)",
                            }}
                          >
                            {on && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--rf-paper)" strokeWidth="1.6" strokeLinecap="round">
                                <path d="M1.5 4.2 L3.2 6 L6.5 2.2" />
                              </svg>
                            )}
                          </span>
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                </FieldRow>
              );
            })}
          </Sheet>

          <div className="flex flex-wrap items-center justify-between gap-5 pb-[18px] pt-[14px]">
            <p
              className="max-w-[380px]"
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--rf-text-4)",
              }}
            >
              Feeds the trends in Mirror. No streaks, no reminders unless you ask.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => log(false)}
                disabled={busy}
                className="rounded-full transition-colors disabled:opacity-40"
                style={{
                  boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                  color: "var(--rf-text-2)",
                  fontSize: "12.5px",
                  padding: "8px 15px",
                }}
              >
                Log and stop
              </button>
              <button
                onClick={() => log(true)}
                disabled={busy}
                className="rounded-full transition-colors disabled:opacity-40"
                style={{
                  background: "var(--rf-text)",
                  color: "var(--rf-paper)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  padding: "9px 18px",
                }}
              >
                {busy ? "Logging…" : "Log, then write"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </PageBg>
  );
}
