"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrisisResourcePanel } from "@/components/ui/crisis-resource-panel";
import {
  JournalGuidanceSidebar,
  GuidanceToggle,
} from "@/components/ui/journal-guidance-sidebar";
import { Toast } from "@/components/ui/toast";

/**
 * The journal entry writing surface.
 *
 * ── What is deliberately absent ───────────────────────────────────────────────
 * There is no AI here. No responses, no suggestions, no inline actions, nothing
 * that reads what is being typed. The entry is the user's own writing, and the
 * theory of change depends on that: people learn about themselves by articulating
 * without something shaping the articulation as it happens.
 *
 * The only thing that touches the text is the safety classifier, and only when
 * the entry is marked done — never during writing, and it never produces visible
 * output unless it detects Tier 2/3, in which case resources appear.
 *
 * ── Saving ────────────────────────────────────────────────────────────────────
 * Debounced autosave keeps a draft alive so nothing is lost to a closed tab or a
 * stray navigation. "Done" marks it complete and runs classification. A completed
 * entry can still be edited; saving again re-runs classification, because content
 * that becomes concerning after an edit matters just as much.
 */

const AUTOSAVE_DEBOUNCE_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function JournalEntry({
  entryId,
  initialText,
  initialCompletedAt,
  initialGuidanceOpen,
}: {
  entryId: string;
  initialText: string;
  initialCompletedAt: string | null;
  initialGuidanceOpen: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tier, setTier] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(initialGuidanceOpen);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The text most recently persisted, so we never save an unchanged body. */
  const savedTextRef = useRef(initialText);

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
      } catch {
        setSaveState("error");
      }
    },
    [entryId]
  );

  // Debounced autosave. Fires once the user pauses rather than per keystroke.
  useEffect(() => {
    if (text === savedTextRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save(text), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, save]);

  // Last-chance save when the tab closes mid-sentence. sendBeacon survives
  // teardown where fetch does not, and it is fire-and-forget by design.
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

  function toggleGuidance() {
    const next = !guidanceOpen;
    setGuidanceOpen(next);
    // Persisted so the choice survives a reload. Fire-and-forget: a failed
    // preference write should never interrupt writing, and the worst case is
    // the panel reverting next visit.
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
      setToast(completedAt ? "Changes saved" : "Entry saved");
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

  return (
    <div className="flex flex-col h-screen bg-white text-stone-800">
      <header className="shrink-0 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine
        </h1>
        <nav className="flex items-center gap-4">
          <GuidanceToggle open={guidanceOpen} onToggle={toggleGuidance} />
          <Link href="/reflections" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Reflections
          </Link>
          <Link href="/mirror" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Mirror
          </Link>
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {/* Entry takes 1fr, sidebar a fixed 20rem — never an equal split, and the
          sidebar column disappears entirely when collapsed so the width returns
          to the writing. Below lg the sidebar leaves the flow and overlays. */}
      <div
        className={`flex-1 min-h-0 ${
          guidanceOpen ? "lg:grid lg:grid-cols-[1fr_20rem]" : ""
        }`}
      >
        <main className="min-h-0 h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 h-full flex flex-col">
            <label htmlFor="entry-body" className="sr-only">
              Your reflection
            </label>
            <textarea
              id="entry-body"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              placeholder="Write whatever is on your mind."
              className="flex-1 min-h-[24rem] w-full resize-none bg-transparent text-[15px] text-stone-800 placeholder-stone-300 leading-relaxed focus:outline-none"
            />

            {tier !== null && <CrisisResourcePanel tier={tier} />}
          </div>
        </main>

        <JournalGuidanceSidebar
          open={guidanceOpen}
          onClose={() => setGuidanceOpen(false)}
        />
      </div>

      <footer className="shrink-0 border-t border-stone-100 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-stone-400" aria-live="polite">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && !dirty && (completedAt ? "Saved" : "Draft saved")}
            {saveState === "error" && (
              <span className="text-red-600">
                Couldn&apos;t save — your text is still here, check your connection
              </span>
            )}
            {saveState === "idle" && !completedAt && "Draft"}
          </p>

          <div className="flex items-center gap-3">
            {confirmDelete ? (
              <>
                <span className="text-xs text-stone-500">Move to trash?</span>
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-600 hover:text-red-700 transition-colors"
                >
                  Move to trash
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-stone-400 hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            )}

            <button
              onClick={handleDone}
              disabled={!text.trim() || completing}
              className="px-4 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
            >
              {completing ? "Saving…" : completedAt ? "Save changes" : "Done"}
            </button>
          </div>
        </div>
      </footer>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
