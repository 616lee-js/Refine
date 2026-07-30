"use client";

import { getGuidanceSections } from "@/lib/journal/guidance";

/**
 * Optional guidance beside the journal writing surface.
 *
 * ── It never reads the entry ──────────────────────────────────────────────────
 * This component takes no entry text, receives no reference to the textarea, and
 * observes nothing about what is being written. That is structural, not a
 * convention: there is no prop through which the body could reach it. It sits
 * beside the writing, never responds to it, and never interrupts.
 *
 * ── Width ─────────────────────────────────────────────────────────────────────
 * A fixed 20rem column while the entry takes the remaining space. Collapsing
 * returns the full width to the entry. It is never an equal split — the writing
 * is the primary surface at every size.
 *
 * ── Below lg ──────────────────────────────────────────────────────────────────
 * Leaves the layout entirely and becomes an overlay panel. On a narrow screen the
 * entry is alone by default; guidance is one tap away and one tap gone.
 */

function GuidanceBody() {
  const sections = getGuidanceSections();

  return (
    <div className="space-y-8">
      <p className="text-xs text-stone-400 leading-relaxed">
        Optional. Nothing here is a prompt to answer, and none of it looks at what
        you&apos;ve written.
      </p>

      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          {section.title && (
            <h3 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
              {section.title}
            </h3>
          )}
          <ul className="space-y-4">
            {section.items.map((item) => (
              <li key={item.id} className="space-y-1">
                <p className="text-sm font-medium text-stone-700">{item.title}</p>
                <p className="text-xs text-stone-500 leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The toggle. Rendered in the entry header at every width. */
export function GuidanceToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="journal-guidance"
      className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
    >
      {open ? "Hide guidance" : "Guidance"}
    </button>
  );
}

export function JournalGuidanceSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* lg and up: a column in the grid. Hidden entirely when collapsed, which
          is what returns the width to the entry. */}
      {open && (
        <aside
          id="journal-guidance"
          aria-label="Journaling guidance"
          className="hidden lg:block border-l border-stone-100 overflow-y-auto"
        >
          <div className="px-6 py-8">
            <GuidanceBody />
          </div>
        </aside>
      )}

      {/* Below lg: an overlay. Never squeezes the writing surface. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close guidance"
            onClick={onClose}
            className="flex-1 bg-stone-900/20"
          />
          <div
            id="journal-guidance-overlay"
            role="dialog"
            aria-label="Journaling guidance"
            className="w-[min(20rem,85vw)] bg-white border-l border-stone-100 overflow-y-auto"
          >
            <div className="px-6 py-6">
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Close
                </button>
              </div>
              <GuidanceBody />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
