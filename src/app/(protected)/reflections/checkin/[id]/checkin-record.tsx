"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
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
 * ── Three states ──────────────────────────────────────────────────────────────
 * A response that has never been completed opens editable — that is today's
 * check-in, and making someone press "edit" to log it would be friction for
 * nothing. A completed one opens READ-ONLY and is re-opened deliberately, the
 * same shape as an entry: a stray tap on a past day should not quietly rewrite
 * what happened.
 *
 * Edit mode autosaves as you go (a PUT, which never completes or scores), and
 * ends either way:
 *   Save    PATCH — records the answers, back to the view
 *   Cancel  PUT of the snapshot taken when editing began, back to the view
 *
 * Cancel writes rather than merely navigating, because autosave has probably
 * already persisted the change it is undoing.
 *
 * ── It brings no page chrome ──────────────────────────────────────────────────
 * No PageBg, no TopNav, no rail of its own. This renders inside the archive's
 * main view beside the record rail, which is what makes opening a check-in stay
 * on the page instead of navigating to a screen of its own. `/checkin/[id]`
 * redirects here; the separate check-in panel it used to carry is gone, because
 * the archive rail filtered to check-ins is the same list.
 *
 * ── No streaks ────────────────────────────────────────────────────────────────
 * `loggedRecently` is a count of what happened, shown only once there is enough
 * history for it to read as a record rather than a scoreboard. Early on — when
 * "1 of the last 21 days" would land as failure — it is simply absent. Nothing
 * here congratulates, warns, or notices a gap.
 */

// COPY REVIEW: shipped wording hoisted; `[COPY]` items are placeholders.
const COPY = {
  eyebrow: "Daily check-in",
  recentCount: (n: number) => `${n} of the last 21 days logged`,
  footnote: "Feeds the trends in Mirror. No streaks, no reminders unless you ask.",
  unanswered: "[COPY] Not answered",

  edit: "[COPY] Edit",
  save: "[COPY] Save check-in",
  saveThenWrite: "[COPY] Save, then write",
  saving: "[COPY] Saving…",
  cancel: "[COPY] Cancel",
  cancelling: "[COPY] Discarding…",

  autosaving: "[COPY] Saving…",
  autosaved: "[COPY] Saved",
  autosaveError: "[COPY] Couldn't save that — your answers are still here",
  logError: "Couldn't log that — your answers are still here",
  cancelError: "[COPY] Couldn't discard those changes",
} as const;

const AUTOSAVE_DEBOUNCE_MS = 1000;

type AutosaveState = "idle" | "saving" | "saved" | "error";

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

/** The read-only rendering of a recorded answer. */
function ReadValue({
  field,
  value,
}: {
  field: TrackerField;
  value: Answers[string] | undefined;
}) {
  const muted = { fontSize: "13px", color: "var(--rf-text-4)" };

  if (value === undefined) {
    return <p style={muted}>{COPY.unanswered}</p>;
  }

  if (field.kind === "count" && typeof value === "number") {
    return (
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          color: "var(--rf-text)",
        }}
      >
        {value}
        {field.unit ?? ""}
      </p>
    );
  }

  if (field.kind === "scale" && typeof value === "number") {
    return (
      <div className="flex items-center gap-3">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            color: "var(--rf-text)",
          }}
        >
          {value}
        </span>
        <Eyebrow size={9.5}>{`of ${field.steps}`}</Eyebrow>
      </div>
    );
  }

  if (field.kind === "toggles" && typeof value === "object") {
    const on = field.options.filter(
      (o) => (value as Record<string, boolean>)[o.key]
    );
    if (on.length === 0) return <p style={muted}>{COPY.unanswered}</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {on.map((o) => (
          <span
            key={o.key}
            className="rounded-full"
            style={{
              padding: "5px 11px",
              fontSize: "12.5px",
              color: "var(--rf-text)",
              background: "var(--rf-accent-2-soft)",
              boxShadow: "inset 0 0 0 1px var(--rf-accent-2)",
            }}
          >
            {o.label}
          </span>
        ))}
      </div>
    );
  }

  return <p style={muted}>{COPY.unanswered}</p>;
}

export function CheckinRecord({
  responseId,
  questionnaire: q,
  initialAnswers,
  initialCompleted,
  initialEditing,
  loggedRecently,
  today,
}: {
  responseId: string;
  questionnaire: TrackerQuestionnaire;
  initialAnswers: Answers;
  /** Whether this response has already been recorded. */
  initialCompleted: boolean;
  /** Open straight into edit mode — a new response, or `?edit=1`. */
  initialEditing: boolean;
  /** Days logged out of the last 21, or null when there isn't enough history. */
  loggedRecently: number | null;
  today: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  /** What the answers were when this edit began. Cancel restores it. */
  const snapshotRef = useRef<Answers>(initialAnswers);
  /** What is currently persisted, so an unchanged form is never re-saved. */
  const savedRef = useRef<Answers>(initialAnswers);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The autosave on the wire, so Save and Cancel can wait for it. */
  const inFlightRef = useRef<Promise<void> | null>(null);

  function setValue(key: string, value: Answers[string]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  /** Draft save. PUT never completes or scores the response. */
  const autosaveAnswers = useCallback(
    async (value: Answers) => {
      setAutosave("saving");
      const request = (async () => {
        try {
          const res = await fetch(`/api/questionnaires/${responseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: value }),
          });
          if (!res.ok) throw new Error(String(res.status));
          savedRef.current = value;
          setAutosave("saved");
        } catch {
          setAutosave("error");
        }
      })();
      inFlightRef.current = request;
      await request;
      if (inFlightRef.current === request) inFlightRef.current = null;
    },
    [responseId]
  );

  // Debounced autosave, only while editing.
  useEffect(() => {
    if (!editing) return;
    if (JSON.stringify(answers) === JSON.stringify(savedRef.current)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => void autosaveAnswers(answers),
      AUTOSAVE_DEBOUNCE_MS
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [answers, editing, autosaveAnswers]);

  function startEditing() {
    snapshotRef.current = answers;
    setAutosave("idle");
    setEditing(true);
  }

  /** Records the answers: scores, completes, and routes any safety item. */
  async function log(thenWrite: boolean) {
    setBusy(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      await inFlightRef.current;
      const res = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error(String(res.status));
      savedRef.current = answers;

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

      // Back to the view, on this response rather than home: the panel is here,
      // and what was just logged should be visible as a record of the day.
      setEditing(false);
      setAutosave("idle");
      setBusy(false);
      router.refresh();
    } catch {
      setBusy(false);
      setToast(COPY.logError);
    }
  }

  /** Abandons the edit, writing the snapshot back over any autosaved change. */
  async function cancelEditing() {
    setBusy(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      await inFlightRef.current;
      const snapshot = snapshotRef.current;
      if (JSON.stringify(savedRef.current) !== JSON.stringify(snapshot)) {
        const res = await fetch(`/api/questionnaires/${responseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: snapshot }),
        });
        if (!res.ok) throw new Error(String(res.status));
        savedRef.current = snapshot;
      }
      setAnswers(snapshot);
      setAutosave("idle");
      setEditing(false);
      setBusy(false);
    } catch {
      setBusy(false);
      setToast(COPY.cancelError);
    }
  }

  return (
    <>
            <div className="flex flex-wrap items-end justify-between gap-5 pb-[14px]">
              <div>
                <Eyebrow accent>{COPY.eyebrow}</Eyebrow>
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
                <Eyebrow size={9.5}>{COPY.recentCount(loggedRecently)}</Eyebrow>
              )}
            </div>

            <Sheet className="px-[30px] pb-[18px] pt-[6px]">
              {q.fields.map((field, i) => {
                const last = i === q.fields.length - 1;

                if (!editing) {
                  return (
                    <FieldRow key={field.key} field={field} last={last}>
                      <ReadValue field={field} value={answers[field.key]} />
                    </FieldRow>
                  );
                }

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
                {editing && autosave !== "idle" ? (
                  <span
                    aria-live="polite"
                    style={
                      autosave === "error"
                        ? { color: "var(--color-error)" }
                        : undefined
                    }
                  >
                    {autosave === "saving" && COPY.autosaving}
                    {autosave === "saved" && COPY.autosaved}
                    {autosave === "error" && COPY.autosaveError}
                  </span>
                ) : (
                  COPY.footnote
                )}
              </p>

              <div className="flex items-center gap-3">
                {!editing ? (
                  <button
                    onClick={startEditing}
                    className="rounded-full transition-colors"
                    style={{
                      boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                      color: "var(--rf-text-2)",
                      fontSize: "12.5px",
                      padding: "8px 15px",
                    }}
                  >
                    {COPY.edit}
                  </button>
                ) : (
                  <>
                    {/* Cancel only where there is a recorded version to go back
                        to. A response that has never been completed has none. */}
                    {initialCompleted && (
                      <button
                        onClick={cancelEditing}
                        disabled={busy}
                        className="rounded-full transition-colors disabled:opacity-40"
                        style={{
                          boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                          color: "var(--rf-text-2)",
                          fontSize: "12.5px",
                          padding: "8px 15px",
                        }}
                      >
                        {busy ? COPY.cancelling : COPY.cancel}
                      </button>
                    )}
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
                      {COPY.save}
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
                      {busy ? COPY.saving : COPY.saveThenWrite}
                    </button>
                  </>
                )}
              </div>
            </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
