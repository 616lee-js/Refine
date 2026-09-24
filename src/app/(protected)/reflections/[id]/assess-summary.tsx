"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import type { EntrySummary } from "@/lib/summaries/types";

/**
 * Assessing a summary against the entry it describes.
 *
 * ── Side by side, because the judgement is a comparison ───────────────────────
 * The read-back page stacks the summary above the entry, which is right for
 * reading and wrong for checking one against the other. Assessing puts them in
 * two columns so both are in view while the rubric is answered.
 *
 * ── Yes is always the acceptable answer ───────────────────────────────────────
 * Every item is worded so that "yes" means the summariser did the right thing.
 * Three items asking "did something go wrong" and a fourth asking "is it right"
 * is how counts get read backwards later, so the questions are phrased to match
 * rather than the data being flipped afterwards.
 *
 * ── Nothing is pre-selected ───────────────────────────────────────────────────
 * An unanswered item cannot be submitted. A default of "yes" would be counted
 * later as the summariser getting it right when nobody said so, which is worse
 * than having no row at all.
 *
 * ── It changes nothing for this user ──────────────────────────────────────────
 * Submitting does not alter their own future summaries. This is evidence about
 * the summariser, for system-level review.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  assess: "[COPY] Assess this summary",
  close: "[COPY] Close",
  heading: "[COPY] How accurate was this summary?",
  lede: "[COPY] Compare it against what you wrote. This helps improve summarising for everyone — it will not change how your own entries are summarised.",

  summaryColumn: "[COPY] What Refine took",
  entryColumn: "[COPY] Your words",
  correctedNote:
    "[COPY] You have since corrected this summary. What's shown here is Refine's original version — that's the part being assessed.",

  supported: "[COPY] Is everything it says supported by your entry?",
  supportedHint: "[COPY] Nothing invented or assumed",
  complete: "[COPY] Did it capture the key facts and anyone named?",
  completeHint: "[COPY] Nothing important left out",
  quotes: "[COPY] Are the quotes word for word?",
  quotesHint: "[COPY] Copied exactly, not reworded",
  descriptive: "[COPY] Did it stay descriptive?",
  descriptiveHint: "[COPY] Described what you wrote, without judging you",

  yes: "[COPY] Yes",
  no: "[COPY] No",
  noQuotes: "[COPY] No quotes",

  accuracy: "[COPY] Overall accuracy",
  scale: [
    "[COPY] Unusable",
    "[COPY] Mostly wrong",
    "[COPY] Usable with fixes",
    "[COPY] Good, minor issues",
    "[COPY] Accurate",
  ],

  notesLabel: "[COPY] Anything else — what it missed, or how you'd put it",
  notesPlaceholder: "[COPY] Optional",

  submit: "[COPY] Submit",
  submitting: "[COPY] Submitting…",
  incomplete: "[COPY] Answer each question above first",
  failed: "[COPY] That didn't send. Your answers are still here — try again.",
  done: "[COPY] Thanks — recorded",
} as const;

type YesNo = boolean | null;
/** Distinguishes "not answered yet" from "no quotes to judge". */
type QuoteAnswer = boolean | "none" | null;

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
  /** The third option, for the quotes item only. */
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

export function AssessSummary({
  entryId,
  summary,
  body,
  corrected = false,
}: {
  entryId: string;
  /** Always the AI's original — see the call site for why, not the correction. */
  summary: EntrySummary;
  body: string;
  /** True when the writer has since corrected the summary shown on read-back. */
  corrected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<YesNo>(null);
  const [complete, setComplete] = useState<YesNo>(null);
  const [quotes, setQuotes] = useState<QuoteAnswer>(null);
  const [descriptive, setDescriptive] = useState<YesNo>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const answered =
    supported !== null &&
    complete !== null &&
    quotes !== null &&
    descriptive !== null &&
    accuracy !== null;

  async function submit() {
    if (!answered) {
      setError(COPY.incomplete);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reflections/${entryId}/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supported,
          complete,
          // "none" is sent as null — the column's way of saying there was
          // nothing to judge, distinct from a failed check.
          quotesVerbatim: quotes === "none" ? null : quotes,
          descriptiveOnly: descriptive,
          overallAccuracy: accuracy,
          notes,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setOpen(false);
      setToast(COPY.done);
      setSupported(null);
      setComplete(null);
      setQuotes(null);
      setDescriptive(null);
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
        <div className="mt-[14px]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full transition-colors"
            style={{
              padding: "7px 14px",
              fontSize: "12.5px",
              color: "var(--rf-text-2)",
              boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
            }}
          >
            {COPY.assess}
          </button>
        </div>
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

        {/* Side by side at lg, stacked below it — comparing two columns on a
            phone is worse than reading them in sequence. */}
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <Eyebrow size={9}>{COPY.summaryColumn}</Eyebrow>
            {/* Said plainly, because the read-back above shows their corrected
                version and this panel does not. */}
            {corrected && (
              <p
                className="mt-1"
                style={{
                  fontSize: "11.5px",
                  lineHeight: 1.5,
                  color: "var(--rf-text-4)",
                }}
              >
                {COPY.correctedNote}
              </p>
            )}
            <div
              className="mt-2 rounded-[4px] px-4 py-3"
              style={{
                background: "var(--rf-surface)",
                boxShadow: "inset 0 0 0 1px var(--rf-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "var(--rf-text-2)",
                }}
              >
                {summary.summary}
              </p>
              {summary.topics.length > 0 && (
                <p
                  className="mt-2"
                  style={{ fontSize: "11.5px", color: "var(--rf-text-3)" }}
                >
                  {summary.topics.join(" · ")}
                </p>
              )}
              {summary.people.length > 0 && (
                <p
                  className="mt-1"
                  style={{ fontSize: "11.5px", color: "var(--rf-text-3)" }}
                >
                  {summary.people.join(" · ")}
                </p>
              )}
              {summary.quotes.map((q, i) => (
                <p
                  key={i}
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "13px",
                    fontStyle: "italic",
                    color: "var(--rf-text-2)",
                    borderLeft: "2px solid var(--rf-border)",
                    paddingLeft: 9,
                  }}
                >
                  {q.text}
                </p>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow size={9}>{COPY.entryColumn}</Eyebrow>
            <div
              className="mt-2 overflow-y-auto rounded-[4px] px-4 py-3"
              style={{ maxHeight: 320, background: "var(--rf-paper)" }}
            >
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                  color: "var(--rf-text)",
                }}
              >
                {body}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
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
            label={COPY.quotes}
            hint={COPY.quotesHint}
            value={quotes}
            onChange={(v) => setQuotes(v)}
            extra={COPY.noQuotes}
          />
          <Choice
            label={COPY.descriptive}
            hint={COPY.descriptiveHint}
            value={descriptive}
            onChange={(v) => setDescriptive(v as boolean)}
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
            htmlFor="assess-notes"
            className="mb-[6px] block"
            style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
          >
            {COPY.notesLabel}
          </label>
          <textarea
            id="assess-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={COPY.notesPlaceholder}
            className="w-full resize-none rounded-[4px] px-3 py-2 outline-none"
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--rf-text)",
              background: "var(--rf-paper)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          />
        </div>

        {error && (
          <p
            aria-live="polite"
            className="mt-2"
            style={{ fontSize: "12px", color: "var(--color-error)" }}
          >
            {error}
          </p>
        )}

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
