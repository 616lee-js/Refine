"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { AssessReport } from "./assess-report";

/**
 * Mirror · Report — what Refine has noticed across someone's writing.
 *
 * ── It is read, not sorted ────────────────────────────────────────────────────
 * There is nothing to approve here and nothing to dismiss. The one control is
 * Edit, because the report is Refine's account of a person and they get the
 * last word on it. Their version is what Mirror shows from then on, and what the
 * next run builds on.
 *
 * ── The history is period notes, not old reports ──────────────────────────────
 * The report at the top always describes everything written so far, rewritten
 * each run. Underneath it, each past run's short account of its own fortnight,
 * newest first. That is the difference worth preserving: the top is current, the
 * list below is what changed and when.
 *
 * Collapsed by default. Someone opening Mirror wants the current account, not a
 * wall of everything Refine has ever said about them.
 */

// COPY REVIEW: every user-facing string here — the disclaimer above all.
const COPY = {
  asOf: (date: string, entries: number, since: string) =>
    `[COPY] As of ${date} · covering ${entries} ${entries === 1 ? "entry" : "entries"} since ${since}`,
  edited: "[COPY] Edited by you",
  edit: "[COPY] Edit",
  cancel: "[COPY] Cancel",
  save: "[COPY] Save",
  saving: "[COPY] Saving…",
  revert: "[COPY] Restore Refine's version",
  saved: "[COPY] Saved",
  reverted: "[COPY] Put back",
  saveError: "[COPY] Couldn't save that",

  /*
   * The disclaimer.
   *
   * Above the report rather than inside it, and never inside the text the model
   * writes: a hedge in the middle of a paragraph is read past, and a hedge the
   * model is responsible for producing is a hedge that can go missing. This one
   * is always there because the code puts it there.
   */
  disclaimer:
    "[COPY] This is Refine's reading of what you have written, not an assessment of you. Where it notes a pattern resembling something, that is a resemblance and nothing more. It can be wrong, and you can change it.",

  delete: "[COPY] Delete this report",
  deleteConfirm: "[COPY] Delete for good?",
  deleteCancel: "[COPY] Keep it",
  deleteError: "[COPY] Couldn't delete that",

  historyHeading: (n: number) =>
    `[COPY] Earlier reports (${n})`,
  historyPeriod: (start: string, end: string) => `[COPY] ${start} – ${end}`,

  emptyTitle:
    "[COPY] Nothing yet. Refine looks back across what you have written every couple of weeks, and writes up what it notices.",
  emptyNote:
    "[COPY] The first one arrives once there is enough writing to look back on.",
} as const;

export type ReportPeriod = {
  id: string;
  /** The short account of that window. Not editable. */
  note: string;
  windowStart: string;
  windowEnd: string;
};

export type CurrentReport = {
  id: string;
  text: string;
  /** True when the person has rewritten it. */
  edited: boolean;
  createdAt: string;
  windowStart: string;
  entriesRead: number;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportPanel({
  current,
  history,
}: {
  current: CurrentReport | null;
  history: ReportPeriod[];
}) {
  const [text, setText] = useState(current?.text ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edited, setEdited] = useState(current?.edited ?? false);
  const [shown, setShown] = useState(current?.text ?? "");
  // Two presses, not a browser dialog. Deleting a report is permanent and the
  // confirm should sit in the page rather than in a box that gets dismissed
  // reflexively.
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/mirror/${current.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(String(res.status));
      // Whatever is newest now — the previous report, or the empty state.
      window.location.reload();
    } catch {
      setError(COPY.deleteError);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function save(next: string) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/mirror/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { edited: boolean };
      setEdited(data.edited);
      setEditing(false);
      // Reverting returns Refine's version, which the client does not hold —
      // so the page is reloaded rather than guessed at.
      if (!data.edited) {
        setToast(COPY.reverted);
        window.location.reload();
        return;
      }
      setShown(next.trim());
      setToast(COPY.saved);
    } catch {
      setError(COPY.saveError);
    } finally {
      setBusy(false);
    }
  }

  if (!current) {
    return (
      <Sheet className="px-6 py-6">
        <p
          className="max-w-[560px]"
          style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--rf-text-2)" }}
        >
          {COPY.emptyTitle}
        </p>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}
        >
          {COPY.emptyNote}
        </p>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <Eyebrow size={9.5}>
            {COPY.asOf(
              fmt(current.createdAt),
              current.entriesRead,
              fmt(current.windowStart)
            )}
          </Eyebrow>

          <div className="flex items-center gap-3">
            {edited && (
              <span style={{ fontSize: "11px", color: "var(--rf-text-4)" }}>
                {COPY.edited}
              </span>
            )}
            {!editing &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={busy}
                    className="rounded-full transition-colors disabled:opacity-40"
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      color: "var(--rf-paper)",
                      background: "var(--color-error)",
                    }}
                  >
                    {COPY.deleteConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{ fontSize: "12px", color: "var(--rf-text-3)" }}
                  >
                    {COPY.deleteCancel}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setText(shown);
                      setEditing(true);
                    }}
                    className="rounded-full transition-colors"
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      color: "var(--rf-text-2)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                    }}
                  >
                    {COPY.edit}
                  </button>
                  <AssessReport reportId={current.id} edited={edited} />
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
                  >
                    {COPY.delete}
                  </button>
                </>
              ))}
          </div>
        </div>

        {/* Always present, never model-written. See the note on COPY.disclaimer. */}
        <p
          className="mt-3 rounded-[4px] px-3 py-2"
          style={{
            fontSize: "11.5px",
            lineHeight: 1.55,
            color: "var(--rf-text-3)",
            background: "var(--rf-surface)",
          }}
        >
          {COPY.disclaimer}
        </p>

        {editing ? (
          <div className="mt-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              maxLength={20_000}
              className="w-full resize-y rounded-[4px] px-4 py-3 outline-none"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "15px",
                lineHeight: 1.75,
                color: "var(--rf-text)",
                background: "var(--rf-paper)",
                boxShadow: "inset 0 0 0 1px var(--rf-border)",
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void save(text)}
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
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
              >
                {COPY.cancel}
              </button>
              {edited && (
                <button
                  type="button"
                  onClick={() => void save("")}
                  disabled={busy}
                  className="ml-auto"
                  style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
                >
                  {COPY.revert}
                </button>
              )}
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
          </div>
        ) : (
          <p
            className="mt-4 whitespace-pre-wrap"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "15px",
              lineHeight: 1.75,
              color: "var(--rf-text)",
            }}
          >
            {shown}
          </p>
        )}
      </Sheet>

      {history.length > 0 && (
        <details className="mt-5">
          <summary
            className="cursor-pointer list-none py-2"
            style={{ fontSize: "13px", color: "var(--rf-text-3)" }}
          >
            {COPY.historyHeading(history.length)}
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {history.map((h) => (
              <Sheet key={h.id} className="px-5 py-4">
                <Eyebrow size={9}>
                  {COPY.historyPeriod(fmt(h.windowStart), fmt(h.windowEnd))}
                </Eyebrow>
                <p
                  className="mt-2 whitespace-pre-wrap"
                  style={{
                    fontSize: "13.5px",
                    lineHeight: 1.65,
                    color: "var(--rf-text-2)",
                  }}
                >
                  {h.note}
                </p>
              </Sheet>
            ))}
          </div>
        </details>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
