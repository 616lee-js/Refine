"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import type { EntrySummary } from "@/lib/summaries/types";

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
 * ── Collapsed by default ──────────────────────────────────────────────────────
 * Native <details>, so keyboard and screen-reader behaviour come free. Collapsed
 * because someone re-reading their own writing has not asked to be told what it
 * said — the summary is available, not imposed.
 */

export function EntrySummaryPanel({
  entryId,
  summary,
  aiOriginal,
  source,
  generationVersion,
  generatedAt,
  stale,
  unreadable,
}: {
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
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary?.summary ?? "");
  const [topics, setTopics] = useState((summary?.topics ?? []).join(", "));
  const [people, setPeople] = useState((summary?.people ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const mono = {
    fontFamily: "var(--font-mono)",
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  };

  async function save() {
    if (!draft.trim()) {
      setError("A summary cannot be empty.");
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
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEditing(false);
      setToast("Saved — this is what Refine will use");
      router.refresh();
    } catch {
      setError("That didn't save. Your text is still here — try again.");
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
      setToast("Back to Refine's version");
      router.refresh();
    } catch {
      setError("Couldn't undo that.");
    } finally {
      setBusy(false);
    }
  }

  // ── No summary yet ─────────────────────────────────────────────────────────
  if (!summary && !unreadable) {
    return (
      <p className="pt-[18px]" style={{ ...mono, color: "var(--rf-text-4)" }}>
        Summarising — check back in a moment
      </p>
    );
  }

  if (unreadable) {
    return (
      <p
        className="pt-[18px]"
        style={{ fontSize: "12.5px", color: "var(--color-error)" }}
      >
        The summary of this entry could not be read. Your writing above is
        unaffected.
      </p>
    );
  }

  const shown = showOriginal && aiOriginal ? aiOriginal : summary!;

  return (
    <>
      <details className="pt-[18px]">
        <summary
          className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1"
          style={{ color: "var(--rf-text-3)" }}
        >
          <span style={{ fontSize: "13px" }}>What Refine took from this</span>
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
              Your version
            </span>
          )}
          {generationVersion && (
            <span style={{ ...mono, color: "var(--rf-text-4)" }}>
              {generationVersion}
            </span>
          )}
        </summary>

        <Sheet className="mt-3 px-6 py-5">
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
              This describes an earlier version of the entry. Refine will
              re-summarise it shortly
              {source === "user" && "; your correction is kept either way"}.
            </p>
          )}

          {shown.thin && !editing && (
            <p
              className="mb-2"
              style={{ ...mono, color: "var(--rf-text-4)" }}
            >
              Short entry — deliberately minimal
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
                  Summary
                </label>
                <textarea
                  id="summary-body"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full resize-none rounded-[4px] px-3 py-2 outline-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "var(--rf-text)",
                    background: "var(--rf-surface)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border)",
                  }}
                />
              </div>

              {[
                ["Topics", topics, setTopics, "summary-topics"] as const,
                ["People", people, setPeople, "summary-people"] as const,
              ].map(([label, value, setter, htmlId]) => (
                <div key={htmlId}>
                  <label
                    htmlFor={htmlId}
                    className="mb-[6px] block"
                    style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                  >
                    {label}{" "}
                    <span style={{ color: "var(--rf-text-4)" }}>
                      — separated by commas
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
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(summary!.summary);
                    setTopics(summary!.topics.join(", "));
                    setPeople(summary!.people.join(", "));
                    setError(null);
                  }}
                  style={{ ...mono, color: "var(--rf-text-3)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px",
                  lineHeight: 1.65,
                  color: "var(--rf-text)",
                  textWrap: "pretty",
                }}
              >
                {shown.summary}
              </p>

              {(shown.topics.length > 0 || shown.people.length > 0) && (
                <div className="mt-4 flex flex-col gap-2">
                  {(
                    [
                      ["Topics", shown.topics],
                      ["People", shown.people],
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
                    onClick={() => setEditing(true)}
                    style={{ ...mono, color: "var(--rf-text-2)" }}
                  >
                    {source === "user" ? "Edit yours" : "Correct this"}
                  </button>
                )}

                {source === "user" && (
                  <>
                    <button
                      onClick={() => setShowOriginal((v) => !v)}
                      style={{ ...mono, color: "var(--rf-text-3)" }}
                    >
                      {showOriginal ? "Back to yours" : "See Refine's version"}
                    </button>
                    <button
                      onClick={revert}
                      disabled={busy}
                      style={{ ...mono, color: "var(--rf-text-4)" }}
                    >
                      Discard mine
                    </button>
                  </>
                )}

                <span style={{ ...mono, color: "var(--rf-text-4)" }}>
                  {showOriginal
                    ? "Refine's original"
                    : generatedAt
                      ? `Generated ${new Date(generatedAt).toLocaleDateString(
                          undefined,
                          { day: "numeric", month: "short" }
                        )}`
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
        </Sheet>
      </details>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
