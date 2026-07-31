"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CrisisResourcePanel } from "@/components/ui/crisis-resource-panel";
import {
  JournalGuidanceSidebar,
  GuidanceToggle,
} from "@/components/ui/journal-guidance-sidebar";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { Toast } from "@/components/ui/toast";
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
 * the entry is set down — never during writing, and it produces nothing visible
 * unless it detects Tier 2/3, in which case resources appear below.
 *
 * ── The anti-essay layer ──────────────────────────────────────────────────────
 * The sheet is bounded: it opens at 330px with a visible bottom edge so the page
 * looks fillable rather than infinite, and grows only as the writing does. Under
 * the text, above that edge, sits a descriptive norm — not a target. There is no
 * word count, no progress bar, no minimum, and finishing costs one button.
 */

const AUTOSAVE_DEBOUNCE_MS = 1500;

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
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(initialGuidanceOpen);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The text most recently persisted, so an unchanged body is never re-saved. */
  const savedTextRef = useRef(initialText);

  const guidanceCount = getGuidanceSections().reduce(
    (n, s) => n + s.items.length,
    0
  );

  const save = useCallback(
    async (value: string) => {
      if (value === savedTextRef.current) return;
      setSaveState("saving");
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

  // The textarea grows with its content so the sheet's bottom edge moves down
  // rather than the text scrolling inside a fixed box. Bounded start, unbounded
  // growth — the sheet must never become an internal scroll region.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
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

  async function handleDone() {
    if (!text.trim() || completing) return;
    setCompleting(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    try {
      const res = await fetch(`/api/reflections/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { tier: number; completedAt: string };
      savedTextRef.current = text;
      setCompletedAt(data.completedAt);
      setTier(data.tier);
      setSaveState("saved");
      setToast(completedAt ? "Changes saved" : "Set down");
    } catch {
      setSaveState("error");
    } finally {
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
      <TopNav active="today" admin={admin}>
        <GuidanceToggle
          open={guidanceOpen}
          onToggle={() => toggleGuidance(!guidanceOpen)}
        />
      </TopNav>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col items-center px-6 pb-[30px] pt-[38px] sm:px-10">
          <div className="w-full" style={{ maxWidth: 620 }}>
            <Sheet minHeight={330} className="px-[34px] pb-[22px] pt-[26px]">
              {/* Header */}
              <div
                className="flex items-center justify-between gap-4 pb-[14px]"
                style={{ borderBottom: "1px solid var(--rf-rule)" }}
              >
                <Eyebrow accent size={10}>
                  Open reflection
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
                  Your reflection
                </label>
                <textarea
                  id="entry-body"
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                  rows={1}
                  placeholder="Start anywhere. A sentence is a whole entry."
                  className="w-full resize-none overflow-hidden bg-transparent focus:outline-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18.5px",
                    lineHeight: 1.62,
                    letterSpacing: "-0.003em",
                    color: "var(--rf-text)",
                    minHeight: "6.5rem",
                  }}
                />
              </div>

              {/* The norm — descriptive, never a target. */}
              <div
                className="pt-[18px]"
                style={{ borderTop: "1px solid var(--rf-rule)" }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.5,
                    color: "var(--rf-text-4)",
                    maxWidth: 420,
                  }}
                >
                  Most entries here run three or four sentences. Stop when
                  you&apos;ve said the true thing.
                </p>
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
                {saveState === "saving" && "Saving…"}
                {saveState === "saved" &&
                  !dirty &&
                  (savedAt ? `Saved ${savedAt}` : completedAt ? "Saved" : "Draft saved")}
                {saveState === "error" && (
                  <span style={{ color: "var(--color-error)" }}>
                    Couldn&apos;t save — your text is still here, check your
                    connection
                  </span>
                )}
                {saveState === "idle" && !completedAt && "Draft"}
              </p>

              <div className="flex items-center gap-3">
                {confirmDelete ? (
                  <>
                    <span
                      style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
                    >
                      Move to trash?
                    </span>
                    <button
                      onClick={handleDelete}
                      className="transition-colors"
                      style={{ fontSize: "12.5px", color: "var(--color-error)" }}
                    >
                      Move to trash
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="transition-colors"
                      style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="transition-colors hover:!text-[var(--color-error)]"
                    style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                  >
                    Delete
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
                    ? "Saving…"
                    : completedAt
                      ? "Save changes"
                      : "Set it down"}
                </button>
              </div>
            </div>

            {tier !== null && <CrisisResourcePanel tier={tier} />}
          </div>
        </div>

        <JournalGuidanceSidebar
          open={guidanceOpen}
          onOpen={() => toggleGuidance(true)}
          onClose={() => toggleGuidance(false)}
          itemCount={guidanceCount}
        />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </PageBg>
  );
}
