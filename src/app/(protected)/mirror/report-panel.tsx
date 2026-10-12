"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { domainLabel } from "@/lib/mirror/domains";
import type { StructuredReport } from "@/lib/mirror/read";
import { AssessReport } from "./assess-report";

/**
 * Mirror · Report — what Refine has noticed across someone's writing.
 *
 * ── An overall account, then areas of life ────────────────────────────────────
 * The report opens with what the person is actually writing about and then breaks
 * that out by the areas it touches, which come from a fixed list — see
 * lib/mirror/domains.ts. Only areas the writing supports appear.
 *
 * The sections are **data, not formatting**. There is no markdown renderer in
 * this project, so a `## Health` in a string would display as those characters;
 * and a heading inside a free-text box is one keystroke from being destroyed.
 *
 * ── It is read, not sorted ────────────────────────────────────────────────────
 * There is nothing to approve here and nothing to dismiss. The one control is
 * Edit, because the report is Refine's account of a person and they get the
 * last word on it. Their version is what Mirror shows from then on, and what the
 * next run builds on.
 *
 * ── The history is period notes, not old reports ──────────────────────────────
 * The report at the top always describes everything written so far, rewritten
 * each run. Underneath it, each past run's short account of its own window,
 * newest first. That is the difference worth preserving: the top is current, the
 * list below is what changed and when.
 *
 * Collapsed by default. Someone opening Mirror wants the current account, not a
 * wall of everything Refine has ever said about them.
 */

/**
 * The most a person may type into one part of a report.
 *
 * Per part rather than over the whole thing, because each part is saved on its
 * own. Generous: this is their account of their own life. The route enforces the
 * same number.
 */
export const MAX_PART_CHARS = 20_000;

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

  /** Above the figures, which are Trends' own strings and not editable here. */
  figuresHeading: "[COPY] Your figures",

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

  historyHeading: (n: number) => `[COPY] Earlier reports (${n})`,
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
  /** The report itself: an overall account, areas of life, and the figures. */
  report: StructuredReport;
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

/**
 * One part of the report — the overall account, or one area.
 *
 * ── Defined out here on purpose ───────────────────────────────────────────────
 * Declared inside `ReportPanel` this would be a new component type on every
 * render, so React would unmount and remount the textarea on every keystroke:
 * the cursor would jump to the end and `autoFocus` would re-fire. The props are
 * verbose; a textarea that loses the caret mid-sentence is worse.
 */
function Part({
  heading,
  text,
  size,
  open,
  draft,
  busy,
  error,
  onStartEdit,
  onDraft,
  onSave,
  onCancel,
}: {
  heading: string | null;
  text: string;
  /** Font size — the overall account reads larger than an area. */
  size: number;
  open: boolean;
  draft: string;
  busy: boolean;
  error: string | null;
  onStartEdit: () => void;
  onDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (open) {
    return (
      <div>
        {heading && <Eyebrow size={9.5}>{heading}</Eyebrow>}
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={heading ? 7 : 14}
          maxLength={MAX_PART_CHARS}
          autoFocus
          className="mt-2 w-full resize-y rounded-[4px] px-4 py-3 outline-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: `${size}px`,
            lineHeight: 1.75,
            color: "var(--rf-text)",
            background: "var(--rf-paper)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
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
            onClick={onCancel}
            style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
          >
            {COPY.cancel}
          </button>
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
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        {heading ? <Eyebrow size={9.5}>{heading}</Eyebrow> : <span />}
        <button
          type="button"
          onClick={onStartEdit}
          className="font-mono uppercase transition-colors"
          style={{
            fontSize: "9px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-4)",
          }}
        >
          {COPY.edit}
        </button>
      </div>
      <p
        className="mt-2 whitespace-pre-wrap"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: `${size}px`,
          lineHeight: 1.75,
          color: "var(--rf-text)",
        }}
      >
        {text}
      </p>
    </div>
  );
}

export function ReportPanel({
  current,
  history,
}: {
  current: CurrentReport | null;
  history: ReportPeriod[];
}) {
  /*
   * ── One editor per part, not one over the whole report ────────────────────
   * A single free-text box over structured data means one stray keystroke can
   * destroy a section, and nothing would notice: the save route stores a blob,
   * and the next run reads whatever is there as the account to build on.
   *
   * So `editing` names the part that is open — "overall", or an area's key — and
   * a save sends the whole report with that one part changed. Same shape as the
   * three Profile answers, for the same reason.
   */
  const [report, setReport] = useState<StructuredReport>(
    current?.report ?? { overall: "", sections: [], figures: [] }
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edited, setEdited] = useState(current?.edited ?? false);
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

  /** Sends the whole report. `null` reverts to Refine's version. */
  async function save(next: StructuredReport | null) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/mirror/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: next }),
      });
      // Checked, not assumed. A failed save that still showed the new text would
      // lose their rewrite on the next reload with nothing to warn them.
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { edited: boolean };
      setEdited(data.edited);
      setEditing(null);
      // Reverting returns Refine's version, which the client does not hold — so
      // the page is reloaded rather than guessed at.
      if (!data.edited) {
        setToast(COPY.reverted);
        window.location.reload();
        return;
      }
      if (next) setReport(next);
      setToast(COPY.saved);
    } catch {
      setError(COPY.saveError);
    } finally {
      setBusy(false);
    }
  }

  /** Applies the open draft to whichever part it belongs to. */
  function saveDraft() {
    if (editing === null) return;
    if (editing === "overall") {
      void save({ ...report, overall: draft });
      return;
    }
    void save({
      ...report,
      sections: report.sections.map((s) =>
        s.domain === editing ? { ...s, text: draft } : s
      ),
    });
  }

  function startEditing(part: string, value: string) {
    setDraft(value);
    setError(null);
    setEditing(part);
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
            {editing === null &&
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
                  <AssessReport reportId={current.id} edited={edited} />
                  {/* Revert moved up here from inside the editor: with one editor
                      per part, "put the whole thing back" is not an action that
                      belongs to any one of them. */}
                  {edited && (
                    <button
                      type="button"
                      onClick={() => void save(null)}
                      disabled={busy}
                      style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
                    >
                      {COPY.revert}
                    </button>
                  )}
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

        {/* The overall account leads, unheaded — it IS the report, and the areas
            below are it broken out. A heading of its own would make it look like
            one section among eight. */}
        <div className="mt-4">
          <Part
            heading={null}
            text={report.overall}
            size={15}
            open={editing === "overall"}
            draft={draft}
            busy={busy}
            error={error}
            onStartEdit={() => startEditing("overall", report.overall)}
            onDraft={setDraft}
            onSave={saveDraft}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
          />
        </div>

        {/* Only areas the writing supported. An empty list is a correct report for
            a window with nothing area-specific in it, not a missing section. */}
        {report.sections.length > 0 && (
          <div className="mt-6 flex flex-col gap-5">
            {report.sections.map((s) => (
              <div
                key={s.domain}
                style={{ borderTop: "1px solid var(--rf-rule)", paddingTop: 16 }}
              >
                <Part
                  heading={domainLabel(s.domain) ?? s.domain}
                  text={s.text}
                  size={14}
                  open={editing === s.domain}
                  draft={draft}
                  busy={busy}
                  error={error}
                  onStartEdit={() => startEditing(s.domain, s.text)}
                  onDraft={setDraft}
                  onSave={saveDraft}
                  onCancel={() => {
                    setEditing(null);
                    setError(null);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* The figures, outside the areas and not editable: these are the exact
            strings Trends puts on its charts, so a number in the report and the
            same number on a chart cannot disagree. An editor here would break
            that, and a sleep median is not a statement about "health" anyway. */}
        {report.figures.length > 0 && (
          <div
            className="mt-6"
            style={{ borderTop: "1px solid var(--rf-rule)", paddingTop: 16 }}
          >
            <Eyebrow size={9.5}>{COPY.figuresHeading}</Eyebrow>
            <div className="mt-2 flex flex-col gap-1">
              {report.figures.map((f, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-2)",
                  }}
                >
                  {f}
                </p>
              ))}
            </div>
          </div>
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
