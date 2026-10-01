"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import type { Answers, TrackerQuestionnaire } from "@/lib/questionnaires";

/**
 * The daily check-in, answered on Home.
 *
 * ── Why it is not the check-in screen ─────────────────────────────────────────
 * Pressing the old strip created a record and navigated away, which is four taps
 * of work behind a page change. The check-in screen still exists and is still
 * where an old one is read and edited from the archive; this is the same four
 * fields where you already are.
 *
 * ── Deliberately compact, and deliberately not autosaving ─────────────────────
 * The check-in screen debounces a draft save per change, which is right when it is
 * the only thing on screen. Here it would mean Home writing to the database while
 * someone is on their way to something else. One Save, pressed on purpose.
 *
 * ── It never scores anything, and there is no streak ──────────────────────────
 * A tracker has no total — adding hours slept to a mood rating produces a number
 * that looks like a measurement and is not. Nothing here congratulates, counts a
 * run of days, or mentions a day that was missed. That is a product rule, not a
 * styling choice: a daily surface is exactly where streak mechanics creep in.
 */

// COPY REVIEW: placeholders. Field labels and notes come from the instrument
// definition and are not copy — see lib/questionnaires/daily-checkin.ts.
const COPY = {
  eyebrow: "[COPY] Today",
  todo: "[COPY] Four taps, if you want them.",
  done: "[COPY] Logged today. Change anything that shifted.",
  save: "[COPY] Save",
  saving: "[COPY] Saving…",
  saved: "[COPY] Saved",
  update: "[COPY] Update",
  failed: "[COPY] That didn't save. Nothing has been lost — try again.",
  thenWrite: "[COPY] Save, then write",
} as const;

export function HomeCheckin({
  questionnaire: q,
  initialAnswers,
  alreadyToday,
}: {
  questionnaire: TrackerQuestionnaire;
  /** Today's answers where there are any, so this edits rather than duplicates. */
  initialAnswers: Answers;
  alreadyToday: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [busy, setBusy] = useState<null | "save" | "write">(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const answered = Object.keys(answers).length > 0;

  function setValue(key: string, value: Answers[string]) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setSaved(false);
  }

  /**
   * Creates or reopens today's record, then records the answers.
   *
   * Two calls rather than one: `POST /api/questionnaires` owns deciding *which*
   * record this is — a draft left unfinished, today's already-completed one, or a
   * new one — and duplicating that decision here is how the two would drift. It is
   * also what stops "Change it" creating a second check-in for the same day.
   */
  async function save(thenWrite: boolean) {
    setBusy(thenWrite ? "write" : "save");
    setFailed(false);
    try {
      const open = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: q.slug }),
      });
      if (!open.ok) throw new Error(String(open.status));
      const { responseId } = (await open.json()) as { responseId: string };

      const rec = await fetch(`/api/questionnaires/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, note: "" }),
      });
      // Checked, not assumed. A check-in that looked saved and was not would be
      // discovered as a gap in a trend weeks later.
      if (!rec.ok) throw new Error(String(rec.status));

      if (thenWrite) {
        const entry = await fetch("/api/reflections", { method: "POST" });
        if (entry.ok) {
          const { reflectionId } = (await entry.json()) as { reflectionId: string };
          router.push(`/reflection/${reflectionId}`);
          return;
        }
      }

      setSaved(true);
      setBusy(null);
      // So the greeting line and the calendar below pick up today.
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(null);
    }
  }

  return (
    <div
      className="mt-[18px] rounded-[4px] px-5 py-[16px]"
      style={{ background: "var(--rf-surface)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Eyebrow size={9.5}>{COPY.eyebrow}</Eyebrow>
        <span
          aria-live="polite"
          className="font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-4)",
          }}
        >
          {saved ? COPY.saved : ""}
        </span>
      </div>
      <p
        className="mt-1"
        style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
      >
        {alreadyToday ? COPY.done : COPY.todo}
      </p>

      <div className="mt-[14px] flex flex-wrap items-start gap-x-8 gap-y-[14px]">
        {q.fields.map((field) => {
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
              // Snapped to the field's step, as the server also does — a value
              // the server would reject must not be reachable here.
              setValue(field.key, Math.round(next * 2) / 2);
            };
            return (
              <div key={field.key}>
                <Eyebrow size={9}>{field.label}</Eyebrow>
                <div className="mt-[6px] flex items-center gap-3">
                  <span
                    aria-live="polite"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "20px",
                      color: v === null ? "var(--rf-text-4)" : "var(--rf-text)",
                      minWidth: "2.8rem",
                    }}
                  >
                    {v === null ? "—" : `${v}${field.unit ?? ""}`}
                  </span>
                  <div className="flex gap-[6px]">
                    {[-1, 1].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => step(d)}
                        aria-label={`${d < 0 ? "Less" : "More"} ${field.label.toLowerCase()}`}
                        className="grid place-items-center transition-colors"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                          color: "var(--rf-text-2)",
                          fontSize: "13px",
                        }}
                      >
                        {d < 0 ? "−" : "+"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (field.kind === "scale") {
            const v = answers[field.key] as number | undefined;
            return (
              <fieldset key={field.key}>
                <legend className="sr-only">{field.label}</legend>
                <Eyebrow size={9}>{field.label}</Eyebrow>
                <div className="mt-[6px] flex gap-[5px]">
                  {Array.from({ length: field.steps }, (_, i) => i + 1).map((n) => {
                    const on = v === n;
                    return (
                      <label
                        key={n}
                        className="grid cursor-pointer place-items-center transition-colors"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          fontSize: "12px",
                          background: on ? "var(--rf-accent)" : "transparent",
                          color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                          boxShadow: on
                            ? "none"
                            : "inset 0 0 0 1px var(--rf-border-strong)",
                        }}
                      >
                        <input
                          type="radio"
                          name={field.key}
                          checked={on}
                          onChange={() => setValue(field.key, n)}
                          className="sr-only"
                        />
                        {/* The number is the control; the ends are named below. */}
                        <span aria-hidden="true">{n}</span>
                        <span className="sr-only">
                          {n} of {field.steps}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p
                  className="mt-[5px]"
                  style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
                >
                  {field.endLabels[0]} — {field.endLabels[2]}
                </p>
              </fieldset>
            );
          }

          // Toggles
          const picked = (answers[field.key] as Record<string, boolean>) ?? {};
          return (
            <fieldset key={field.key}>
              <legend className="sr-only">{field.label}</legend>
              <Eyebrow size={9}>{field.label}</Eyebrow>
              <div className="mt-[6px] flex flex-wrap gap-[6px]">
                {field.options.map((o) => {
                  const on = picked[o.key] === true;
                  return (
                    <label
                      key={o.key}
                      className="cursor-pointer rounded-full transition-colors"
                      style={{
                        padding: "4px 10px",
                        fontSize: "11.5px",
                        background: on ? "var(--rf-accent-soft)" : "transparent",
                        color: on ? "var(--rf-text)" : "var(--rf-text-3)",
                        boxShadow: on
                          ? "inset 0 0 0 1px var(--rf-accent)"
                          : "inset 0 0 0 1px var(--rf-border-strong)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setValue(field.key, { ...picked, [o.key]: !on })
                        }
                        className="sr-only"
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {failed && (
        <div className="mt-3">
          <Notice tone="error">{COPY.failed}</Notice>
        </div>
      )}

      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy !== null || !answered}
          className="rounded-full transition-colors disabled:opacity-40"
          style={{
            padding: "7px 15px",
            fontSize: "12.5px",
            fontWeight: 500,
            background: "var(--rf-text)",
            color: "var(--rf-paper)",
          }}
        >
          {busy === "save"
            ? COPY.saving
            : alreadyToday
              ? COPY.update
              : COPY.save}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={busy !== null || !answered}
          className="transition-colors disabled:opacity-40"
          style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
        >
          {busy === "write" ? COPY.saving : COPY.thenWrite}
        </button>
      </div>
    </div>
  );
}
