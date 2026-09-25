"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import { Toast } from "@/components/ui/toast";

/**
 * Assessing a Mirror report.
 *
 * ── No side-by-side ───────────────────────────────────────────────────────────
 * Assessing a summary puts the entry beside it, because the comparison is
 * against one page. A report's subject is everything the person has written, so
 * there is nothing to put beside it — the report is above, and the questions
 * are below.
 *
 * ── The questions are the instructions, turned around ─────────────────────────
 * Each one asks whether a rule in src/lib/layer2/memory-extraction.md held. The
 * last three are the rules that carry real consequence when broken: predicting
 * how someone will be, speaking plainly about a condition they never claimed,
 * and restating their check-in figures in its own words.
 *
 * ── Yes always means the report behaved ───────────────────────────────────────
 * Every question is worded so "yes" is the acceptable answer. Mixed polarity is
 * how a count of failures gets read backwards six months later.
 *
 * ── Nothing is pre-selected, and "none" is not a pass ─────────────────────────
 * Two questions carry a third option for "there was nothing to judge". A report
 * that mentioned no condition must not be recorded as having hedged correctly.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  assess: "[COPY] Assess this report",
  close: "[COPY] Close",
  heading: "[COPY] How accurate was this report?",
  lede: "[COPY] This helps improve how reports are written for everyone — it will not change how your own are written.",

  editedNote:
    "[COPY] You have since edited this report. The questions below are about Refine's original version, which is what is being assessed.",

  supported: "[COPY] Is everything it said backed by your writing?",
  supportedHint: "[COPY] Nothing invented or assumed",
  complete: "[COPY] Did it cover what mattered from this period?",
  completeHint: "[COPY] Nothing important left out",
  descriptive: "[COPY] Did it describe rather than judge you?",
  descriptiveHint: "[COPY] An account of your writing, not a verdict on you",
  prediction: "[COPY] Did it avoid saying how you will be?",
  predictionHint: "[COPY] Describes what happened, not what comes next",
  hedging: "[COPY] Did it hedge properly about conditions?",
  hedgingHint:
    "[COPY] Plain language only where you had already named something yourself",
  figures: "[COPY] Did it leave your check-in numbers alone?",
  figuresHint: "[COPY] Quoted them as written, rather than restating them",

  yes: "[COPY] Yes",
  no: "[COPY] No",
  noneCondition: "[COPY] None mentioned",
  noneFigures: "[COPY] No numbers",

  accuracy: "[COPY] Overall accuracy",
  scale: [
    "[COPY] Unusable",
    "[COPY] Mostly wrong",
    "[COPY] Usable with fixes",
    "[COPY] Good, minor issues",
    "[COPY] Accurate",
  ],

  notesLabel: "[COPY] Anything else — what it got wrong, or what it missed",
  notesPlaceholder: "[COPY] Optional",

  submit: "[COPY] Submit",
  submitting: "[COPY] Submitting…",
  incomplete: "[COPY] Answer each question above first",
  failed: "[COPY] That didn't send. Your answers are still here — try again.",
  done: "[COPY] Thanks — recorded",
} as const;

type YesNo = boolean | null;
/** Distinguishes "not answered yet" from "there was nothing to judge". */
type WithNone = boolean | "none" | null;

function Choice({
  label,
  hint,
  value,
  onChange,
  extra,
}: {
  label: string;
  hint: string;
  value: YesNo | "none";
  onChange: (v: boolean | "none") => void;
  /** The third option, on the two questions that can have nothing to judge. */
  extra?: string;
}) {
  const button = (on: boolean) => ({
    padding: "5px 13px",
    fontSize: "12px",
    borderRadius: 999,
    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
    background: on ? "var(--rf-text)" : "transparent",
    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
  });

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-[11px]"
      style={{ borderTop: "1px solid var(--rf-rule)" }}
    >
      <div className="min-w-0">
        <p style={{ fontSize: "13px", color: "var(--rf-text)" }}>{label}</p>
        <p
          className="mt-[2px]"
          style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
        >
          {hint}
        </p>
      </div>
      <div className="flex shrink-0 gap-[6px]">
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(true)}
          style={button(value === true)}
        >
          {COPY.yes}
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => onChange(false)}
          style={button(value === false)}
        >
          {COPY.no}
        </button>
        {extra && (
          <button
            type="button"
            aria-pressed={value === "none"}
            onClick={() => onChange("none")}
            style={button(value === "none")}
          >
            {extra}
          </button>
        )}
      </div>
    </div>
  );
}

export function AssessReport({
  reportId,
  edited,
}: {
  reportId: string;
  /** True when the person has rewritten the report shown above. */
  edited: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<YesNo>(null);
  const [complete, setComplete] = useState<YesNo>(null);
  const [descriptive, setDescriptive] = useState<YesNo>(null);
  const [prediction, setPrediction] = useState<YesNo>(null);
  const [hedging, setHedging] = useState<WithNone>(null);
  const [figures, setFigures] = useState<WithNone>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const answered =
    supported !== null &&
    complete !== null &&
    descriptive !== null &&
    prediction !== null &&
    hedging !== null &&
    figures !== null &&
    accuracy !== null;

  async function submit() {
    if (!answered) {
      setError(COPY.incomplete);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/mirror/${reportId}/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supported,
          complete,
          descriptiveOnly: descriptive,
          noPrediction: prediction,
          // "none" travels as null — the column's way of saying there was
          // nothing to judge, which is not the same as a pass.
          hedgingRight: hedging === "none" ? null : hedging,
          figuresUntouched: figures === "none" ? null : figures,
          overallAccuracy: accuracy,
          notes,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setOpen(false);
      setToast(COPY.done);
      setSupported(null);
      setComplete(null);
      setDescriptive(null);
      setPrediction(null);
      setHedging(null);
      setFigures(null);
      setAccuracy(null);
      setNotes("");
    } catch {
      setError(COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
        >
          {COPY.assess}
        </button>
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <>
      <Sheet className="mt-[14px] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow accent size={9.5}>
              {COPY.heading}
            </Eyebrow>
            <p
              className="mt-2 max-w-[520px]"
              style={{
                fontSize: "12.5px",
                lineHeight: 1.55,
                color: "var(--rf-text-3)",
              }}
            >
              {COPY.lede}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-4)",
            }}
          >
            {COPY.close}
          </button>
        </div>

        {/* Said plainly, because the report above is their version and these
            questions are not about it. */}
        {edited && (
          <Notice tone="quiet" className="mt-3">
            {COPY.editedNote}
          </Notice>
        )}

        <div className="mt-4">
          <Choice
            label={COPY.supported}
            hint={COPY.supportedHint}
            value={supported}
            onChange={(v) => setSupported(v as boolean)}
          />
          <Choice
            label={COPY.complete}
            hint={COPY.completeHint}
            value={complete}
            onChange={(v) => setComplete(v as boolean)}
          />
          <Choice
            label={COPY.descriptive}
            hint={COPY.descriptiveHint}
            value={descriptive}
            onChange={(v) => setDescriptive(v as boolean)}
          />
          <Choice
            label={COPY.prediction}
            hint={COPY.predictionHint}
            value={prediction}
            onChange={(v) => setPrediction(v as boolean)}
          />
          <Choice
            label={COPY.hedging}
            hint={COPY.hedgingHint}
            value={hedging}
            onChange={(v) => setHedging(v)}
            extra={COPY.noneCondition}
          />
          <Choice
            label={COPY.figures}
            hint={COPY.figuresHint}
            value={figures}
            onChange={(v) => setFigures(v)}
            extra={COPY.noneFigures}
          />
        </div>

        <div
          className="mt-4 pt-4"
          style={{ borderTop: "1px solid var(--rf-rule)" }}
        >
          <Eyebrow size={9}>{COPY.accuracy}</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-[6px]">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = accuracy === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAccuracy(n)}
                  className="grid place-items-center font-mono"
                  style={{
                    width: 34,
                    height: 30,
                    borderRadius: 4,
                    fontSize: "12px",
                    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                    background: on ? "var(--rf-accent)" : "transparent",
                    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {/* What the numbers mean, stated rather than left to guesswork. */}
          <p
            className="mt-2"
            style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--rf-text-4)" }}
          >
            {COPY.scale.map((s, i) => `${i + 1} ${s}`).join("  ·  ")}
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="assess-report-notes"
            className="mb-[6px] block"
            style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
          >
            {COPY.notesLabel}
          </label>
          <textarea
            id="assess-report-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={COPY.notesPlaceholder}
            className="rf-input resize-none"
          />
        </div>

        {error && <Notice tone="error" className="mt-3">{error}</Notice>}

        <div className="mt-4">
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
            {busy ? COPY.submitting : COPY.submit}
          </button>
        </div>
      </Sheet>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
