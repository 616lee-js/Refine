"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JournalGuidanceSidebar } from "@/components/ui/journal-guidance-sidebar";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { getGuidanceSections } from "@/lib/journal/guidance";

/**
 * The writing surface.
 *
 * ── What is deliberately absent ───────────────────────────────────────────────
 * There is no AI here. No responses, no suggestions, no inline actions, nothing
 * that reads what is being typed. People learn about themselves by articulating
 * without something shaping the articulation as it happens.
 *
 * The only thing that touches the text is the safety classifier, and only when
 * the entry is completed — never during writing. Completing navigates to the
 * read view, which shows resources if the classifier returned Tier 2/3.
 *
 * ── The anti-essay layer ──────────────────────────────────────────────────────
 * The sheet is bounded: it opens at 330px with a visible bottom edge so the page
 * looks fillable rather than infinite, and grows only as the writing does. There
 * is no word count, no progress bar, no minimum, and finishing costs one button.
 * The descriptive norm line that used to sit under the text ("Most entries here
 * run three or four sentences…") was removed 2026-09-21 at the owner's request.
 */

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * ── Growing the textarea without a jump ───────────────────────────────────────
 * The previous auto-grow set `height = "auto"` and then `height = scrollHeight`
 * on every change. That momentary collapse shrinks the document, the browser
 * clamps the scroll position, and the restored height then lands somewhere
 * else — a visible jump, worst on iOS where double-space (→ ". ") and deletes
 * fire it mid-word.
 *
 * Now the textarea sits in a grid cell with a hidden mirror `<div>` that carries
 * the same text and the same type metrics. The mirror sizes the cell; the
 * textarea stretches to fill it. Height is never reset, so nothing can jump.
 * The two MUST share `BODY_TYPE` exactly — any drift in font, line height,
 * padding or wrapping and the textarea clips or over-grows.
 */
const BODY_TYPE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "18.5px",
  lineHeight: 1.62,
  letterSpacing: "-0.003em",
  padding: 0,
  border: 0,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "normal",
};

/** Opening height of the writing area. On the mirror, since the mirror sizes the cell. */
const BODY_MIN_HEIGHT = "6.5rem";

/**
 * ── Keeping the caret off the bottom edge ─────────────────────────────────────
 * Browsers scroll a textarea's caret into view by the minimum amount, which on
 * a growing page pins the line being written to the very bottom of the screen.
 * After each change the caret line is measured (via a second, absolutely
 * positioned mirror) and the window scrolled so it keeps this much clearance.
 * `pb` below reserves room to scroll into once the sheet has grown.
 */
const CARET_CLEARANCE_PX = 160;
const CARET_TOP_CLEARANCE_PX = 96;

/**
 * COPY REVIEW — every user-facing string on the writing surface, in one place.
 *
 * Strings marked `[COPY]` are placeholders: the owner is supplying final wording
 * separately and nothing here should be read as a proposal. The rest is the
 * wording that shipped before this pass, hoisted so the review can see all of it
 * at once. The foothold rail's strings live in
 * src/components/ui/journal-guidance-sidebar.tsx and src/lib/journal/guidance.ts.
 */
const COPY = {
  eyebrow: "Open reflection",
  bodyLabel: "Your reflection", // screen-reader only
  placeholder: "Start anywhere. A sentence is a whole entry.",

  // Status line under the sheet
  saving: "Saving…",
  savedAt: (time: string) => `Saved ${time}`,
  saved: "Saved",
  draftSaved: "Draft saved",
  draft: "Draft",
  saveError: "Couldn't save — your text is still here, check your connection",

  // Delete flow
  delete: "Delete",
  confirmDelete: "Move to trash?",
  confirmDeleteYes: "Move to trash",
  cancel: "Cancel",

  // Finishing. The confirmation itself is shown on the read view — see
  // src/app/(protected)/reflections/[id]/page.tsx.
  completing: "Saving…",
  complete: "[COPY] Complete entry",
  saveChanges: "[COPY] Save changes",
  cancelEdit: "[COPY] Cancel", // completed entries only: discard the edit
} as const;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function JournalEntry({
  entryId,
  admin,
  initialText,
  initialCompletedAt,
  initialGuidanceOpen,
}: {
  /** Rendered admin entry points from the server parent — see admin-nav.tsx. */
  admin: React.ReactNode;
  entryId: string;
  initialText: string;
  initialCompletedAt: string | null;
  initialGuidanceOpen: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  // Fixed for the life of this surface: completing navigates away, so there is
  // no transition from draft to completed to render here.
  const completedAt = initialCompletedAt;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(initialGuidanceOpen);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Sizes the grid cell the textarea stretches into. See BODY_TYPE. */
  const sizeMirrorRef = useRef<HTMLDivElement>(null);
  /** Off-layout copy used only to find the caret's line. */
  const caretMirrorRef = useRef<HTMLDivElement>(null);
  /** True once the sheet has grown past its opening height — unlocks bottom room. */
  const [grown, setGrown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The text most recently persisted, so an unchanged body is never re-saved. */
  const savedTextRef = useRef(initialText);

  const guidanceCount = getGuidanceSections().reduce(
    (n, s) => n + s.items.length,
    0
  );

  /**
   * The autosave currently on the wire, if any. Finishing and cancelling both
   * wait for it: a PUT that lands after the PATCH (or after the revert) would
   * silently overwrite the body with an older draft.
   */
  const inFlightRef = useRef<Promise<void> | null>(null);

  const save = useCallback(
    async (value: string) => {
      if (value === savedTextRef.current) return;
      setSaveState("saving");
      const request = (async () => {
        try {
          const res = await fetch(`/api/reflections/${entryId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: value }),
          });
          if (!res.ok) throw new Error(String(res.status));
          savedTextRef.current = value;
          setSaveState("saved");
          setSavedAt(
            new Date().toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          );
        } catch {
          setSaveState("error");
        }
      })();
      inFlightRef.current = request;
      await request;
      if (inFlightRef.current === request) inFlightRef.current = null;
    },
    [entryId]
  );

  // Debounced autosave. Fires once the user pauses, not per keystroke.
  useEffect(() => {
    if (text === savedTextRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save(text), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, save]);

  // Last-chance save when the tab closes mid-sentence. sendBeacon survives
  // teardown where fetch does not, and is fire-and-forget by design.
  useEffect(() => {
    const flush = () => {
      if (text === savedTextRef.current) return;
      navigator.sendBeacon(
        `/api/reflections/${entryId}`,
        new Blob([JSON.stringify({ text })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [text, entryId]);

  // Growth itself is CSS now (see BODY_TYPE). What remains in JS is keeping the
  // caret clear of the viewport edge, and noticing when the sheet has grown.
  //
  // Layout effect, not effect: the scroll must land in the same frame as the
  // new text, or the caret is painted at the edge for one frame and then moves.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const size = sizeMirrorRef.current;
    const caret = caretMirrorRef.current;
    if (!ta || !size || !caret) return;

    const minPx = parseFloat(getComputedStyle(size).minHeight) || 0;
    setGrown(size.offsetHeight > minPx + 1);

    // Only while writing. Restoring a draft, or the page settling after
    // navigation, must not scroll anything.
    if (document.activeElement !== ta) return;

    // Text up to the caret, then a marker whose box is the caret's line. The
    // marker is a zero-width character so it cannot wrap onto a line of its own.
    const end = ta.selectionEnd ?? text.length;
    caret.textContent = text.slice(0, end);
    const marker = document.createElement("span");
    marker.textContent = "​";
    caret.appendChild(marker);
    const line = marker.getBoundingClientRect();
    caret.textContent = "";

    // The visual viewport, not the layout one: on iPad the keyboard shrinks the
    // former and leaves the latter alone, and the clearance has to be measured
    // against what is actually visible.
    const vv = window.visualViewport;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

    if (line.bottom > viewBottom - CARET_CLEARANCE_PX) {
      window.scrollBy({ top: line.bottom - (viewBottom - CARET_CLEARANCE_PX) });
    } else if (line.top < viewTop + CARET_TOP_CLEARANCE_PX) {
      window.scrollBy({ top: line.top - (viewTop + CARET_TOP_CLEARANCE_PX) });
    }
  }, [text]);

  function toggleGuidance(next: boolean) {
    setGuidanceOpen(next);
    // Fire-and-forget: a failed preference write must never interrupt writing,
    // and the worst case is the rail reverting next visit.
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guidanceOpen: next }),
    }).catch(() => {});
  }

  /**
   * Finishing leaves this surface. A completed entry is read at
   * /reflections/[id] and re-opened for editing deliberately from there — it is
   * never left sitting in an editor that happens to also be "done". The read
   * view shows the confirmation and, for a Tier 2/3 result, the resources; the
   * tier itself is stored on the row, so nothing has to travel in the URL.
   */
  async function handleDone() {
    if (!text.trim() || completing) return;
    setCompleting(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    try {
      await inFlightRef.current;
      const res = await fetch(`/api/reflections/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      savedTextRef.current = text;
      setSaveState("saved");
      router.push(
        `/reflections/${entryId}?${completedAt ? "saved" : "completed"}=1`
      );
      // `completing` stays true: the button must not re-enable while the
      // navigation is in flight.
    } catch {
      setSaveState("error");
      setCompleting(false);
    }
  }

  /**
   * Abandons an edit of a completed entry. If an autosave already landed, the
   * pre-edit text is written back first — otherwise "cancel" would keep changes
   * the user just said they did not want. That write bumps `updated_at`, so the
   * queue re-summarises identical text once; the price of never losing a body.
   */
  async function handleCancelEdit() {
    if (completing) return;
    setCompleting(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    try {
      await inFlightRef.current;
      if (savedTextRef.current !== initialText) {
        const res = await fetch(`/api/reflections/${entryId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: initialText }),
        });
        if (!res.ok) throw new Error(String(res.status));
        savedTextRef.current = initialText;
      }
      // Nothing left unsaved to flush on unload: the ref now matches what is
      // stored, and the in-memory draft is being discarded on purpose.
      setText(initialText);
      router.push(`/reflections/${entryId}`);
    } catch {
      setSaveState("error");
      setCompleting(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/reflections/${entryId}`, { method: "DELETE" });
    router.push("/reflections");
  }

  const dirty = text !== savedTextRef.current;
  const started = new Date();

  return (
    <PageBg>
      {/* No foothold toggle in the nav (removed 2026-09-21). The rail is
          reached only from its own right-hand edge, at every width. */}
      <TopNav active="today" admin={admin} />

      <div className="flex min-h-0 flex-1">
        {/* Bottom room appears only once the sheet has grown past its opening
            height. A fresh page keeps its visible bottom edge and no scrollbar;
            a long entry gets somewhere for the caret to scroll into. */}
        <div
          className="flex min-w-0 flex-1 flex-col items-center px-6 pt-[38px] sm:px-10"
          style={{ paddingBottom: grown ? "35vh" : 30 }}
        >
          <div className="w-full" style={{ maxWidth: 620 }}>
            <Sheet minHeight={330} className="px-[34px] pb-[22px] pt-[26px]">
              {/* Header */}
              <div
                className="flex items-center justify-between gap-4 pb-[14px]"
                style={{ borderBottom: "1px solid var(--rf-rule)" }}
              >
                <Eyebrow accent size={10}>
                  {COPY.eyebrow}
                </Eyebrow>
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    color: "var(--rf-text-3)",
                  }}
                >
                  {started.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>

              {/* The writing */}
              <div className="flex flex-1 flex-col pt-5">
                <label htmlFor="entry-body" className="sr-only">
                  {COPY.bodyLabel}
                </label>

                {/* One grid cell, two occupants: the mirror sets the height,
                    the textarea stretches to it. minmax(0, 1fr) so a long
                    unbroken word cannot widen the cell past the sheet. */}
                <div
                  className="relative grid"
                  style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
                >
                  <div
                    ref={sizeMirrorRef}
                    aria-hidden="true"
                    className="invisible"
                    style={{
                      ...BODY_TYPE,
                      gridArea: "1 / 1 / 2 / 2",
                      minHeight: BODY_MIN_HEIGHT,
                    }}
                  >
                    {/* Trailing space so a newline at the end still counts
                        as a line — an empty last line has no height. */}
                    {text + " "}
                  </div>

                  <textarea
                    id="entry-body"
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoFocus
                    rows={1}
                    placeholder={COPY.placeholder}
                    className="w-full resize-none overflow-hidden bg-transparent focus:outline-none"
                    style={{
                      ...BODY_TYPE,
                      gridArea: "1 / 1 / 2 / 2",
                      color: "var(--rf-text)",
                    }}
                  />

                  {/* Caret-measurement mirror. Absolute, so it never affects
                      layout; its content is written and cleared imperatively
                      in the layout effect above. */}
                  <div
                    ref={caretMirrorRef}
                    aria-hidden="true"
                    className="pointer-events-none invisible absolute inset-x-0 top-0"
                    style={BODY_TYPE}
                  />
                </div>
              </div>
            </Sheet>

            {/* Action bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p
                aria-live="polite"
                className="font-mono uppercase"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  color: "var(--rf-text-4)",
                }}
              >
                {saveState === "saving" && COPY.saving}
                {saveState === "saved" &&
                  !dirty &&
                  (savedAt
                    ? COPY.savedAt(savedAt)
                    : completedAt
                      ? COPY.saved
                      : COPY.draftSaved)}
                {saveState === "error" && (
                  <span style={{ color: "var(--color-error)" }}>
                    {COPY.saveError}
                  </span>
                )}
                {saveState === "idle" && !completedAt && COPY.draft}
              </p>

              <div className="flex items-center gap-3">
                {confirmDelete ? (
                  <>
                    <span
                      style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                    >
                      {COPY.confirmDelete}
                    </span>
                    <button
                      onClick={handleDelete}
                      className="transition-colors"
                      style={{ fontSize: "12.5px", color: "var(--color-error)" }}
                    >
                      {COPY.confirmDeleteYes}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="transition-colors"
                      style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                    >
                      {COPY.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="transition-colors hover:!text-[var(--color-error)]"
                    style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                  >
                    {COPY.delete}
                  </button>
                )}

                {/* Editing a completed entry can be abandoned. A draft cannot
                    — there is nothing to go back to, and Delete covers it. */}
                {completedAt && !confirmDelete && (
                  <button
                    onClick={handleCancelEdit}
                    disabled={completing}
                    className="rounded-full transition-colors disabled:opacity-40"
                    style={{
                      padding: "8px 15px",
                      fontSize: "12.5px",
                      color: "var(--rf-text-2)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                    }}
                  >
                    {COPY.cancelEdit}
                  </button>
                )}

                <button
                  onClick={handleDone}
                  disabled={!text.trim() || completing}
                  className="rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: "var(--rf-text)",
                    color: "var(--rf-paper)",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    padding: "9px 18px",
                  }}
                >
                  {completing
                    ? COPY.completing
                    : completedAt
                      ? COPY.saveChanges
                      : COPY.complete}
                </button>
              </div>
            </div>
          </div>
        </div>

        <JournalGuidanceSidebar
          open={guidanceOpen}
          onOpen={() => toggleGuidance(true)}
          onClose={() => toggleGuidance(false)}
          itemCount={guidanceCount}
        />
      </div>
    </PageBg>
  );
}
