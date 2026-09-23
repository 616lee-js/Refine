"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import type { LikertQuestionnaire } from "@/lib/questionnaires";

/**
 * A questionnaire response, in the archive's main view.
 *
 * ── Presented as an instrument, not as a clinical assessment ──────────────────
 * No medical blue, no scored-report styling, no risk banners, and **no severity
 * verdict on this screen**. The bands exist, but showing "moderate" the instant
 * someone finishes answering is a diagnosis in everything but name. The
 * plain-language reading belongs to Mirror, over time, where it can say
 * "moderate · up 4 since 11 Jul" and mean something.
 *
 * That rule governs the read view too, which is why a recorded response shows
 * the answers it was given and no total.
 *
 * ── View and edit are separate states ─────────────────────────────────────────
 * A recorded response opens read-only; editing is deliberate, the same shape as
 * an entry or a check-in. Cancel restores the answers as they were when editing
 * began, because "cancel" that merely navigated away would keep the change.
 *
 * Unlike the check-in there is no autosave here: a questionnaire is answered in
 * one sitting, and a debounced PUT per radio press would be a write per
 * keystroke-equivalent for no gain. "Finish later" is the explicit draft save.
 *
 * ── One page, no auto-advance ─────────────────────────────────────────────────
 * Selecting a radio does not move you on. Being able to see all seven at once,
 * change your mind, and answer roughly is the entire point.
 */

const LABEL_COL = 260;

// COPY REVIEW: this screen's own strings. Instrument wording (GAD-7 items and
// response options) is NOT here and must not be edited as copy — it is
// clinical text pending source verification. See lib/questionnaires/.
const COPY = {
  eyebrow: (name: string) => `[COPY] Framework · ${name}`,
  lastTaken: (date: string) => `[COPY] Last taken ${date}`,
  noteLabel: "[COPY] In your own words · optional",
  notePlaceholder: "[COPY] Anything the numbers miss.",
  noAnswer: "[COPY] Not answered",
  noNote: "[COPY] Nothing written",

  footnote:
    "[COPY] Scored and kept in Mirror. You'll see the trend over time — never a diagnosis.",

  edit: "[COPY] Edit",
  finishLater: "[COPY] Finish later",
  recording: "[COPY] Recording…",
  record: "[COPY] Record answers",
  save: "[COPY] Save changes",
  cancel: "[COPY] Cancel",
  cancelling: "[COPY] Discarding…",

  recordedToast: "[COPY] Recorded",
  recordError: "[COPY] Couldn't record that — your answers are still here",
  cancelError: "[COPY] Couldn't discard those changes",
} as const;

export function FrameworkRecord({
  responseId,
  questionnaire: q,
  initialAnswers,
  initialNote,
  initialCompleted,
  initialEditing,
  lastTakenAt,
}: {
  responseId: string;
  questionnaire: LikertQuestionnaire;
  initialAnswers: Record<string, number>;
  initialNote: string;
  /** Whether this response has already been recorded. */
  initialCompleted: boolean;
  /** Open straight into the form — a new response, or `?edit=1`. */
  initialEditing: boolean;
  lastTakenAt: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** What the answers were when this edit began. Cancel restores them. */
  const snapshotRef = useRef({ answers: initialAnswers, note: initialNote });

  const answeredCount = q.items.filter(
    (i) => typeof answers[i.key] === "number"
  ).length;

  function choose(key: string, value: number) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function startEditing() {
    snapshotRef.current = { answers, note };
    setEditing(true);
  }

  /** Draft save. PUT never scores or completes the response. */
  async function finishLater() {
    setBusy(true);
    try {
      const res = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.push("/");
    } catch {
      setBusy(false);
      setToast(COPY.recordError);
    }
  }

  /** Records the answers: scores, completes, and routes any safety item. */
  async function record() {
    setBusy(true);
    try {
      const res = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Back to the read view in place, rather than navigating home: the rail
      // is here, and what was just recorded should be visible as a record.
      setEditing(false);
      setBusy(false);
      setToast(COPY.recordedToast);
      router.refresh();
    } catch {
      setBusy(false);
      setToast(COPY.recordError);
    }
  }

  /** Abandons the edit, writing the snapshot back over anything saved since. */
  async function cancelEditing() {
    const snapshot = snapshotRef.current;
    setBusy(true);
    try {
      // Only worth a write if this response has been recorded before — an
      // uncompleted draft has nothing behind it to restore.
      if (initialCompleted) {
        const res = await fetch(`/api/questionnaires/${responseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (!res.ok) throw new Error(String(res.status));
      }
      setAnswers(snapshot.answers);
      setNote(snapshot.note);
      setEditing(false);
      setBusy(false);
    } catch {
      setBusy(false);
      setToast(COPY.cancelError);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5 pb-[14px]">
        <div>
          <Eyebrow accent>{COPY.eyebrow(q.shortName)}</Eyebrow>
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
              {COPY.lastTaken(
                new Date(lastTakenAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })
              )}
            </Eyebrow>
          )}
        </div>
      </div>

      <Sheet className="px-[30px] pb-[18px] pt-[14px]">
        {/* Column labels, stated once. Every row's radios align under them.
            Edit mode only — the read view states each answer in words. */}
        {editing && (
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
        )}

        <div className="pb-2 sm:hidden">
          <Eyebrow size={9.5}>{q.recallWindow}</Eyebrow>
        </div>
        {!editing && (
          <div className="hidden pb-2 sm:block">
            <Eyebrow size={9.5}>{q.recallWindow}</Eyebrow>
          </div>
        )}

        {q.items.map((item, i) => {
          const selected = answers[item.key];
          const last = i === q.items.length - 1;
          const chosen = q.options.find((o) => o.value === selected);

          const number = (
            <span
              className="w-[14px] shrink-0 pt-1 font-mono"
              style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
          );

          const text = (
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
          );

          // ── Read view: the answer in words, never a number ──────────────
          if (!editing) {
            return (
              <div
                key={item.key}
                className="grid items-center gap-[22px] py-[10px] sm:grid-cols-[1fr_260px]"
                style={{
                  borderBottom: last ? "none" : "1px solid var(--rf-rule)",
                }}
              >
                <div className="flex gap-3">
                  {number}
                  {text}
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: chosen ? "var(--rf-text-2)" : "var(--rf-text-4)",
                  }}
                >
                  {chosen ? chosen.label : COPY.noAnswer}
                </p>
              </div>
            );
          }

          return (
            <fieldset
              key={item.key}
              className="grid items-center gap-[22px] py-[6px] sm:grid-cols-[1fr_260px]"
              style={{
                borderBottom: last ? "none" : "1px solid var(--rf-rule)",
              }}
            >
              <legend className="sr-only">{item.text}</legend>
              <div className="flex gap-3">
                {number}
                {text}
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
                          color: on ? "var(--rf-text-2)" : "var(--rf-text-4)",
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
            {editing ? (
              <>
                <label htmlFor="note">
                  <Eyebrow size={9.5}>{COPY.noteLabel}</Eyebrow>
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={COPY.notePlaceholder}
                  className="mt-2 w-full resize-none bg-transparent focus:outline-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16.5px",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    color: "var(--rf-text)",
                  }}
                />
              </>
            ) : (
              <>
                <Eyebrow size={9.5}>{COPY.noteLabel}</Eyebrow>
                <p
                  className="mt-2 whitespace-pre-wrap"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16.5px",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    color: note ? "var(--rf-text)" : "var(--rf-text-4)",
                  }}
                >
                  {note || COPY.noNote}
                </p>
              </>
            )}
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
          {COPY.footnote}
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
              {/* Cancel only where there is a recorded version to go back to.
                  A response never completed has none; "Finish later" covers it. */}
              {initialCompleted ? (
                <button
                  onClick={cancelEditing}
                  disabled={busy}
                  className="transition-colors disabled:opacity-40"
                  style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                >
                  {busy ? COPY.cancelling : COPY.cancel}
                </button>
              ) : (
                <button
                  onClick={finishLater}
                  disabled={busy}
                  className="transition-colors disabled:opacity-40"
                  style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                >
                  {COPY.finishLater}
                </button>
              )}
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
                {busy
                  ? COPY.recording
                  : initialCompleted
                    ? COPY.save
                    : COPY.record}
              </button>
            </>
          )}
        </div>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
