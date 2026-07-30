"use client";

import { getGuidanceSections } from "@/lib/journal/guidance";
import { Eyebrow } from "./sheet";

/**
 * The foothold rail — optional guidance beside the writing surface.
 *
 * ── It never reads the entry ──────────────────────────────────────────────────
 * This component takes no entry text, receives no reference to the textarea, and
 * observes nothing about what is being written. That is structural, not a
 * convention: there is no prop through which the body could reach it.
 *
 * ── Content ───────────────────────────────────────────────────────────────────
 * v1 ships the repo's practice guidance — about the practice, not the person,
 * and it never asks for a reply. The design's question-shaped footholds ("Any
 * clearer today?") are drawn from previous entries and threads, which needs
 * Cabinet 2 and memory extraction — Phase 6, not built. When those arrive they
 * are `source: "personal"` items with a `sourceLabel`, and the item renderer
 * below already draws the provenance eyebrow for them. No component change.
 *
 * ── Width ─────────────────────────────────────────────────────────────────────
 * 306px open, 48px collapsed, against the entry's `1fr`. Never an equal split.
 * Below `lg` it leaves the layout and becomes an overlay: on a narrow screen a
 * writing surface sharing space with anything else is not a writing surface.
 */

function RailBody({ onCollapse }: { onCollapse: () => void }) {
  const sections = getGuidanceSections();

  return (
    <div className="flex h-full flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Footholds</Eyebrow>
          <p
            className="mt-[7px] max-w-[210px]"
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              color: "var(--rf-text-3)",
            }}
          >
            Offered once, at the start. Use one or ignore them all.
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse footholds"
          className="mt-0.5 shrink-0 transition-colors"
          style={{ color: "var(--rf-text-3)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M5 3 L9.5 7 L5 11" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col overflow-y-auto">
        {sections.map((section) => (
          <section key={section.id}>
            {section.title && (
              <div
                className="pt-[15px] pb-1"
                style={{ borderTop: "1px solid var(--rf-rule)" }}
              >
                <Eyebrow size={9.5}>{section.title}</Eyebrow>
              </div>
            )}
            {section.items.map((item) => (
              <div key={item.id} className="pb-[15px] pt-2">
                {/* Provenance, for personal footholds only — see the note above. */}
                {item.sourceLabel && (
                  <div className="mb-[6px]">
                    <Eyebrow size={9.5} accent>
                      {item.sourceLabel}
                    </Eyebrow>
                  </div>
                )}
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "15.5px",
                    lineHeight: 1.5,
                    color: "var(--rf-text-2)",
                  }}
                >
                  {item.title}
                </p>
                <p
                  className="mt-[5px]"
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.55,
                    color: "var(--rf-text-3)",
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </section>
        ))}
      </div>

      <div
        className="mt-auto pt-[14px]"
        style={{ borderTop: "1px solid var(--rf-rule)" }}
      >
        <button
          type="button"
          onClick={onCollapse}
          className="transition-colors hover:!text-[var(--rf-text)]"
        >
          <Eyebrow size={9.5}>Dismiss all · write cold</Eyebrow>
        </button>
      </div>
    </div>
  );
}

/** The toggle. Present at every width, in the entry header. */
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
      className="transition-colors hover:!text-[var(--rf-text)]"
      style={{ fontSize: "13.5px", color: "var(--rf-text-3)" }}
    >
      {open ? "Hide footholds" : "Footholds"}
    </button>
  );
}

export function JournalGuidanceSidebar({
  open,
  onClose,
  onOpen,
  itemCount,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  itemCount: number;
}) {
  return (
    <>
      {/* lg and up, open: a 306px column. */}
      {open && (
        <aside
          id="journal-guidance"
          aria-label="Journaling guidance"
          className="hidden shrink-0 overflow-y-auto px-[26px] pb-5 pt-[22px] lg:block"
          style={{
            width: 306,
            borderLeft: "1px solid var(--rf-border)",
          }}
        >
          <RailBody onCollapse={onClose} />
        </aside>
      )}

      {/* lg and up, collapsed: a 48px spine. Clicking anywhere on it reopens. */}
      {!open && (
        <aside
          aria-label="Journaling guidance, collapsed"
          className="hidden shrink-0 lg:block"
          style={{ width: 48, borderLeft: "1px solid var(--rf-border)" }}
        >
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={false}
            aria-controls="journal-guidance"
            className="flex h-full w-full flex-col items-center gap-4 pt-[22px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M9 3 L4.5 7 L9 11" />
            </svg>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.2em",
                writingMode: "vertical-rl",
              }}
            >
              Footholds
            </span>
            <span
              className="grid place-items-center font-mono"
              style={{
                fontSize: "10px",
                width: 18,
                height: 18,
                borderRadius: 99,
                background: "var(--rf-accent-soft)",
                color: "var(--rf-accent)",
              }}
            >
              {itemCount}
            </span>
          </button>
        </aside>
      )}

      {/* Below lg: an overlay. Never squeezes the writing surface. */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label="Close footholds"
            onClick={onClose}
            className="flex-1"
            style={{ background: "rgba(40,28,12,0.18)" }}
          />
          <div
            role="dialog"
            aria-label="Journaling guidance"
            className="overflow-y-auto px-[26px] pb-5 pt-[22px]"
            style={{
              width: "min(20rem, 86vw)",
              background: "var(--rf-paper)",
              borderLeft: "1px solid var(--rf-border)",
            }}
          >
            <RailBody onCollapse={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
