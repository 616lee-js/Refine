"use client";

import { countItems, type GuidanceSection } from "@/lib/journal/guidance";
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
 * Practice guidance — about the practice, not the person, never asking for a
 * reply — plus ways to actually write one, plus, since 2026-10-01, footholds drawn
 * from the person's own record: a fact they have confirmed in Mirror, a category or
 * a person recurring across recent summaries, where their last report left off.
 *
 * Those arrive as `source: "personal"` items carrying a `sourceLabel`, and the item
 * renderer below drew that provenance eyebrow before they existed, so adding them
 * needed no change here — only the `sections` prop, because they are read and
 * decrypted on the server. See lib/journal/personal-guidance.ts.
 *
 * None of them is produced by a model. Having the AI write prompts is a separate
 * decision that has not been made.
 *
 * ── Width ─────────────────────────────────────────────────────────────────────
 * 306px open, 48px collapsed, against the entry's `1fr`. Never an equal split.
 * Below `lg` it leaves the layout and becomes an overlay: on a narrow screen a
 * writing surface sharing space with anything else is not a writing surface.
 *
 * ── One way in ────────────────────────────────────────────────────────────────
 * The rail opens only from the right-hand edge — the spine at `lg`, a fixed edge
 * tab below it. There is no toggle in the top nav (removed 2026-09-21).
 */

/**
 * COPY REVIEW — every user-facing string in the foothold rail. Item text lives
 * in src/lib/journal/guidance.ts and is already marked as draft there.
 */
const COPY = {
  title: "Footholds",
  intro: "Offered once, at the start. Use one or ignore them all.",
  collapse: "Collapse footholds", // aria-label
  dismissAll: "Dismiss all · write cold",
  spineLabel: "Footholds", // vertical text on the collapsed spine
  spineAria: "Journaling guidance, collapsed",
  overlayClose: "Close footholds", // aria-label
  regionAria: "Journaling guidance",
} as const;

function RailBody({
  sections,
  onCollapse,
}: {
  sections: GuidanceSection[];
  onCollapse: () => void;
}) {

  return (
    <div className="flex h-full flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>{COPY.title}</Eyebrow>
          <p
            className="mt-[7px] max-w-[210px]"
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              color: "var(--rf-text-3)",
            }}
          >
            {COPY.intro}
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label={COPY.collapse}
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
          <Eyebrow size={9.5}>{COPY.dismissAll}</Eyebrow>
        </button>
      </div>
    </div>
  );
}

/*
 * The header toggle (`GuidanceToggle`) was removed 2026-09-21. The rail is now
 * opened only from its own edge: the 48px spine at `lg` and up, and the fixed
 * edge tab below it. Nothing about footholds appears in the top nav.
 */

export function JournalGuidanceSidebar({
  open,
  onClose,
  onOpen,
  sections,
  overlayOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  /**
   * Built on the server and passed in, rather than read from a module here.
   *
   * The practice guidance is static and could have stayed an import. Footholds
   * drawn from the person's own record cannot: they read the database and decrypt,
   * which a client component cannot do. Both arrive the same way so there is one
   * path rather than two — see lib/journal/personal-guidance.ts.
   */
  sections: GuidanceSection[];
  /**
   * Never take a column of the layout, at any width — the edge tab and its
   * overlay at every size.
   *
   * Used when the writing surface sits beside the archive's record list. A
   * column here would put a rail on both sides of the text, and the writing
   * surface holding width priority is the one rule that outranks visual
   * consistency.
   */
  overlayOnly?: boolean;
}) {
  // Below `lg` these are always the overlay; `overlayOnly` extends that upward.
  const columnAt = overlayOnly ? "hidden" : "hidden lg:block";
  const overlayAt = overlayOnly ? "" : "lg:hidden";

  return (
    <>
      {/* lg and up, open: a 306px column. */}
      {open && (
        <aside
          id="journal-guidance"
          aria-label={COPY.regionAria}
          className={`${columnAt} shrink-0 overflow-y-auto px-[26px] pb-5 pt-[22px]`}
          style={{
            width: 306,
            borderLeft: "1px solid var(--rf-border)",
          }}
        >
          <RailBody sections={sections} onCollapse={onClose} />
        </aside>
      )}

      {/* lg and up, collapsed: a 48px spine. Clicking anywhere on it reopens. */}
      {!open && (
        <aside
          aria-label={COPY.spineAria}
          className={`${columnAt} shrink-0`}
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
              {COPY.spineLabel}
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
              {countItems(sections)}
            </span>
          </button>
        </aside>
      )}

      {/* Below lg, collapsed: a fixed tab on the right edge, vertically
          centred. The rail is an overlay at this width, so it has no spine in
          the layout to reopen from — and with the header toggle gone this tab
          is the only way in. z-30 (floating affordance): it is not modal, and
          the feedback button is bottom-right, so the two never overlap. */}
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={false}
          aria-controls="journal-guidance-overlay"
          aria-label={COPY.spineAria}
          className={`fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 py-3 pl-2 pr-[9px] transition-colors print:hidden ${overlayAt}`}
          style={{
            background: "var(--rf-paper)",
            border: "1px solid var(--rf-paper-edge)",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            boxShadow: "var(--rf-sheet-shadow)",
            color: "var(--rf-text-3)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M9 3 L4.5 7 L9 11" />
          </svg>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.2em",
              writingMode: "vertical-rl",
            }}
          >
            {COPY.spineLabel}
          </span>
        </button>
      )}

      {/* Below lg, open: an overlay. Never squeezes the writing surface. */}
      {open && (
        <div className={`fixed inset-0 z-40 flex ${overlayAt}`}>
          <button
            type="button"
            aria-label={COPY.overlayClose}
            onClick={onClose}
            className="flex-1"
            // Per palette: each one dims to its own depth, and the dark ramps
            // go much further than Dawn's warm 18%.
            style={{ background: "var(--rf-scrim)" }}
          />
          <div
            id="journal-guidance-overlay"
            role="dialog"
            aria-label={COPY.regionAria}
            className="overflow-y-auto px-[26px] pb-5 pt-[22px]"
            style={{
              width: "min(20rem, 86vw)",
              background: "var(--rf-paper)",
              borderLeft: "1px solid var(--rf-border)",
            }}
          >
            <RailBody sections={sections} onCollapse={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
