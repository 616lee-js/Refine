"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { MAX_QUOTES_CURATED, type EntrySummary, type SummaryQuote } from "@/lib/summaries/types";

/**
 * What Refine took from an entry, shown on the read-back page so it can be
 * checked and corrected.
 *
 * ── Corrections live in their own column ──────────────────────────────────────
 * Saving writes `encrypted_user_content`, which the summarisation worker never
 * touches. A regeneration — entry edited, or summariser prompt changed —
 * overwrites only the AI's version, so a correction cannot be destroyed by one.
 * The corrected version is what downstream memory extraction reads; see
 * `authoritativeSummary()` in src/lib/summaries/read.ts.
 *
 * ── Quotes are curated from the text ──────────────────────────────────────────
 * In edit mode the model's quotes can be removed, and new ones arrive through
 * `pendingQuote` — text the person selected in the entry (see ./entry-body.tsx).
 * There is no field to type a quote into. The server verifies every quote is
 * found in the body and rejects the save otherwise.
 *
 * ── It must not look like the entry ───────────────────────────────────────────
 * Both used to be display serif on a paper `Sheet`, which made a machine's
 * description of someone's writing look like the writing. They now get opposite
 * treatments: the summary is sans-serif on a recessed panel, the entry stays
 * serif on paper. The entry did not move — the writing is the thing, and it
 * should not be what changes to accommodate a description of itself.
 *
 * The labels ("What Refine took from this" / "Your words") are the smaller half
 * of that. The treatments carry it: the two are still distinguishable with the
 * page zoomed past the point of reading either.
 *
 * ── Collapsed by default ──────────────────────────────────────────────────────
 * Native <details>, controlled so a quote arriving from the text can open it.
 * Collapsed because someone re-reading their own writing has not asked to be
 * told what it said — the summary is available, not imposed. It now sits above
 * the entry (2026-09-21); whether it should open by default there is the
 * owner's call.
 *
 * ── Categories under review ───────────────────────────────────────────────────
 * `topics` and `people` are flagged for a consistency review: the summariser's
 * vocabulary drifts entry to entry ("Dad" one day, "my father" the next), and
 * nothing here yet normalises it. Rendered as-is until that review lands.
 */

// COPY REVIEW: shipped wording hoisted; `[COPY]` items are placeholders.
const COPY = {
  heading: "[COPY] What Refine took from this",
  yourVersion: "[COPY] Your version",
  summarising: "[COPY] Summarising — check back in a moment",
  unreadable:
    "[COPY] The summary of this entry could not be read. Your writing is unaffected.",
  stale: "[COPY] This describes an earlier version of the entry. Refine will re-summarise it shortly",
  staleKept: "[COPY] ; your correction is kept either way",
  thin: "[COPY] Short entry — deliberately minimal",
  summaryLabel: "[COPY] Summary",
  // "Categories", not "Topics": these are the buckets a record sorts into.
  // The stored field is still `topics` — renaming a key inside a stored JSON
  // blob is a data migration for no benefit.
  topicsLabel: "[COPY] Categories",
  peopleLabel: "[COPY] People",
  commaHint: "[COPY] — separated by commas",
  quotesLabel: "[COPY] Quotes",
  quotesHint: "[COPY] Select text in the entry to add a quote",
  quotesFull: "[COPY] That's the most quotes an entry can keep",
  removeQuote: "[COPY] Remove",
  noSummaryForQuote: "[COPY] No summary yet to attach a quote to",
  emptyError: "[COPY] A summary cannot be empty.",
  saveError: "[COPY] That didn't save. Your text is still here — try again.",
  quoteRejected: "[COPY] One of the quotes wasn't found in the entry",
  revertError: "[COPY] Couldn't undo that.",
  savedToast: "[COPY] Saved — this is what Refine will use",
  revertedToast: "[COPY] Back to Refine's version",
  save: "[COPY] Save",
  saving: "[COPY] Saving…",
  cancel: "[COPY] Cancel",
  correct: "[COPY] Correct this",
  editYours: "[COPY] Edit yours",
  backToYours: "[COPY] Back to yours",
  seeOriginal: "[COPY] See Refine's version",
  discardMine: "[COPY] Discard mine",
  original: "[COPY] Refine's original",
  generated: (date: string) => `[COPY] Generated ${date}`,
} as const;

export type EntrySummaryPanelProps = {
  entryId: string;
  /** The authoritative version — the correction where one exists. */
  summary: EntrySummary | null;
  /** The AI's version, for comparison once corrected. */
  aiOriginal: EntrySummary | null;
  source: "ai" | "user" | null;
  generationVersion: string | null;
  generatedAt: string | null;
  /** The entry has been edited since this was generated. */
  stale: boolean;
  unreadable: boolean;
  /** Text selected in the entry, waiting to become a quote. */
  pendingQuote: string | null;
  onQuoteConsumed: () => void;
};

export function EntrySummaryPanel({
  entryId,
  summary,
  aiOriginal,
  source,
  generationVersion,
  generatedAt,
  stale,
  unreadable,
  pendingQuote,
  onQuoteConsumed,
}: EntrySummaryPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary?.summary ?? "");
  const [topics, setTopics] = useState((summary?.topics ?? []).join(", "));
  const [people, setPeople] = useState((summary?.people ?? []).join(", "));
  const [quotes, setQuotes] = useState<SummaryQuote[]>(summary?.quotes ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // A selection made in the entry lands here. Opens the panel and enters edit
  // mode so the person sees where it went and can save or discard it.
  useEffect(() => {
    if (pendingQuote === null) return;
    onQuoteConsumed();
    if (!summary) {
      setToast(COPY.noSummaryForQuote);
      return;
    }
    setOpen(true);
    setShowOriginal(false);
    setEditing(true);
    setError(null);

    const flat = (s: string) => s.replace(/\s+/g, " ").trim();
    if (quotes.some((q) => flat(q.text) === flat(pendingQuote))) return;
    if (quotes.length >= MAX_QUOTES_CURATED) {
      setError(COPY.quotesFull);
      return;
    }
    // Offset is resolved server-side on save; it is not needed to display.
    setQuotes([...quotes, { text: pendingQuote, offset: null }]);
  }, [pendingQuote, summary, quotes, onQuoteConsumed]);

  const mono = {
    fontFamily: "var(--font-mono)",
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  };

  function resetDraft() {
    setDraft(summary?.summary ?? "");
    setTopics((summary?.topics ?? []).join(", "));
    setPeople((summary?.people ?? []).join(", "));
    setQuotes(summary?.quotes ?? []);
    setError(null);
  }

  async function save() {
    if (!draft.trim()) {
      setError(COPY.emptyError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reflections/${entryId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: draft,
          topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
          people: people.split(",").map((p) => p.trim()).filter(Boolean),
          quotes: quotes.map((q) => q.text),
        }),
      });
      if (res.status === 400) throw new Error("rejected");
      if (!res.ok) throw new Error(String(res.status));
      setEditing(false);
      setToast(COPY.savedToast);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "rejected"
          ? COPY.quoteRejected
          : COPY.saveError
      );
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reflections/${entryId}/summary`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(String(res.status));
      setEditing(false);
      setShowOriginal(false);
      setToast(COPY.revertedToast);
      router.refresh();
    } catch {
      setError(COPY.revertError);
    } finally {
      setBusy(false);
    }
  }

  // ── No summary yet ─────────────────────────────────────────────────────────
  if (!summary && !unreadable) {
    return (
      <>
        <p className="pt-[18px]" style={{ ...mono, color: "var(--rf-text-4)" }}>
          {COPY.summarising}
        </p>
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  if (unreadable) {
    return (
      <p
        className="pt-[18px]"
        style={{ fontSize: "12.5px", color: "var(--color-error)" }}
      >
        {COPY.unreadable}
      </p>
    );
  }

  const shown = showOriginal && aiOriginal ? aiOriginal : summary!;

  return (
    <>
      <details
        className="pt-[18px]"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary
          className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1"
          style={{ color: "var(--rf-text-3)" }}
        >
          <span style={{ fontSize: "13px" }}>{COPY.heading}</span>
          {source === "user" && (
            <span
              className="rounded-full"
              style={{
                padding: "2px 8px",
                fontSize: "9px",
                letterSpacing: "0.14em",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                color: "var(--rf-accent-2)",
                background: "var(--rf-accent-2-soft)",
              }}
            >
              {COPY.yourVersion}
            </span>
          )}
          {generationVersion && (
            <span style={{ ...mono, color: "var(--rf-text-4)" }}>
              {generationVersion}
            </span>
          )}
        </summary>

        {/* A recessed panel, not paper: no shadow, inset border, secondary
            surface. See the note at the top of this file. */}
        <div
          className="mt-3 rounded-[4px] px-6 py-5"
          style={{
            background: "var(--rf-surface)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        >
          {stale && (
            <p
              className="mb-3 rounded-[4px] px-3 py-2"
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--rf-warn)",
                background: "var(--rf-warn-soft)",
              }}
            >
              {COPY.stale}
              {source === "user" && COPY.staleKept}.
            </p>
          )}

          {shown.thin && !editing && (
            <p
              className="mb-2"
              style={{ ...mono, color: "var(--rf-text-4)" }}
            >
              {COPY.thin}
            </p>
          )}

          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="summary-body"
                  className="mb-[6px] block"
                  style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                >
                  {COPY.summaryLabel}
                </label>
                <textarea
                  id="summary-body"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full resize-none rounded-[4px] px-3 py-2 outline-none"
                  style={{
                    // Sans, like the summary it edits. See the note at the top.
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "var(--rf-text)",
                    background: "var(--rf-paper)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border)",
                  }}
                />
              </div>

              {[
                [COPY.topicsLabel, topics, setTopics, "summary-topics"] as const,
                [COPY.peopleLabel, people, setPeople, "summary-people"] as const,
              ].map(([label, value, setter, htmlId]) => (
                <div key={htmlId}>
                  <label
                    htmlFor={htmlId}
                    className="mb-[6px] block"
                    style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                  >
                    {label}{" "}
                    <span style={{ color: "var(--rf-text-4)" }}>
                      {COPY.commaHint}
                    </span>
                  </label>
                  <input
                    id={htmlId}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full rounded-[4px] px-3 py-2 outline-none"
                    style={{
                      fontSize: "13px",
                      color: "var(--rf-text)",
                      background: "var(--rf-surface)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border)",
                    }}
                  />
                </div>
              ))}

              {/* Quotes: remove here, add by selecting in the entry. */}
              <div>
                <p
                  className="mb-[6px]"
                  style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                >
                  {COPY.quotesLabel}{" "}
                  <span style={{ color: "var(--rf-text-4)" }}>
                    {COPY.quotesHint}
                  </span>
                </p>
                {quotes.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {quotes.map((q, i) => (
                      <li
                        key={`${i}-${q.text.slice(0, 24)}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "14px",
                            lineHeight: 1.55,
                            fontStyle: "italic",
                            color: "var(--rf-text-2)",
                            borderLeft: "2px solid var(--rf-border)",
                            paddingLeft: 11,
                          }}
                        >
                          {q.text}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setQuotes((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="shrink-0 pt-[3px]"
                          style={{ ...mono, color: "var(--rf-text-3)" }}
                        >
                          {COPY.removeQuote}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <p
                  aria-live="polite"
                  style={{ fontSize: "12px", color: "var(--color-error)" }}
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded-full transition-colors disabled:opacity-40"
                  style={{
                    padding: "7px 15px",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    background: "var(--rf-text)",
                    color: "var(--rf-paper)",
                  }}
                >
                  {busy ? COPY.saving : COPY.save}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    resetDraft();
                  }}
                  style={{ ...mono, color: "var(--rf-text-3)" }}
                >
                  {COPY.cancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Sans. This is a machine's description of the person's writing,
                  and it must not wear the writing's typeface. The quotes below
                  keep the serif, because those ARE the writing. */}
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.65,
                  color: "var(--rf-text-2)",
                  textWrap: "pretty",
                }}
              >
                {shown.summary}
              </p>

              {(shown.topics.length > 0 || shown.people.length > 0) && (
                <div className="mt-4 flex flex-col gap-2">
                  {(
                    [
                      [COPY.topicsLabel, shown.topics],
                      [COPY.peopleLabel, shown.people],
                    ] as const
                  ).map(([label, items]) =>
                    items.length === 0 ? null : (
                      <div
                        key={label}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                      >
                        <Eyebrow size={9}>{label}</Eyebrow>
                        <span
                          style={{ fontSize: "13px", color: "var(--rf-text-2)" }}
                        >
                          {items.join(" · ")}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {shown.quotes.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {shown.quotes.map((q, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "14px",
                        lineHeight: 1.55,
                        fontStyle: "italic",
                        color: "var(--rf-text-2)",
                        borderLeft: "2px solid var(--rf-border)",
                        paddingLeft: 11,
                      }}
                    >
                      {q.text}
                    </p>
                  ))}
                </div>
              )}

              <div
                className="mt-5 flex flex-wrap items-center gap-4 pt-4"
                style={{ borderTop: "1px solid var(--rf-rule)" }}
              >
                {!showOriginal && (
                  <button
                    onClick={() => {
                      resetDraft();
                      setEditing(true);
                    }}
                    style={{ ...mono, color: "var(--rf-text-2)" }}
                  >
                    {source === "user" ? COPY.editYours : COPY.correct}
                  </button>
                )}

                {source === "user" && (
                  <>
                    <button
                      onClick={() => setShowOriginal((v) => !v)}
                      style={{ ...mono, color: "var(--rf-text-3)" }}
                    >
                      {showOriginal ? COPY.backToYours : COPY.seeOriginal}
                    </button>
                    <button
                      onClick={revert}
                      disabled={busy}
                      style={{ ...mono, color: "var(--rf-text-4)" }}
                    >
                      {COPY.discardMine}
                    </button>
                  </>
                )}

                <span style={{ ...mono, color: "var(--rf-text-4)" }}>
                  {showOriginal
                    ? COPY.original
                    : generatedAt
                      ? COPY.generated(
                          new Date(generatedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })
                        )
                      : ""}
                </span>
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
            </>
          )}
        </div>
      </details>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
