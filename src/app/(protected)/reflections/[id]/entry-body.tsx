"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_QUOTE_CHARS } from "@/lib/summaries/parse";

/**
 * The entry text on the read-back page, with select-to-quote.
 *
 * ── Why selection, and only selection ─────────────────────────────────────────
 * A quote is the writer's own words, findable in their own text. Offering a
 * free-text box would invite a paraphrase, which the server would then reject —
 * a dead end dressed as a feature. Selecting from the entry makes every
 * candidate verbatim by construction; the server's `locate()` check becomes a
 * guard against tampering rather than a thing the UI leads people into.
 *
 * ── It reads nothing ──────────────────────────────────────────────────────────
 * This component holds the body only to display it. The selection listener
 * reports what the person highlighted, once, when they press the button.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  quoteThis: "[COPY] Quote this",
  tooLong: "[COPY] Too long to quote",
} as const;

type Selection = { text: string; x: number; y: number };

export function EntryBody({
  body,
  onQuote,
}: {
  body: string;
  onQuote: (text: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [sel, setSel] = useState<Selection | null>(null);

  useEffect(() => {
    function update() {
      const s = window.getSelection();
      const el = ref.current;
      if (!s || !el || s.isCollapsed || s.rangeCount === 0) {
        setSel(null);
        return;
      }
      const range = s.getRangeAt(0);
      // Only selections that live inside the entry. A selection that starts in
      // the summary panel and drags into the text is not a quote.
      if (
        !el.contains(range.startContainer) ||
        !el.contains(range.endContainer)
      ) {
        setSel(null);
        return;
      }
      const text = s.toString().trim();
      if (!text) {
        setSel(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSel({ text, x: rect.left + rect.width / 2, y: rect.top });
    }

    document.addEventListener("selectionchange", update);
    // The button is fixed-positioned against the viewport; the text is not.
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const tooLong = sel !== null && sel.text.length > MAX_QUOTE_CHARS;

  return (
    <>
      <article
        ref={ref}
        className="whitespace-pre-wrap"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-entry)",
          lineHeight: 1.75,
          color: "var(--rf-text)",
        }}
      >
        {body}
      </article>

      {sel && (
        <button
          type="button"
          disabled={tooLong}
          // mousedown/touchstart would collapse the selection before click
          // fires; the button needs it intact to read.
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => {
            onQuote(sel.text);
            window.getSelection()?.removeAllRanges();
            setSel(null);
          }}
          className="fixed z-30 rounded-full transition-colors disabled:opacity-60"
          style={{
            left: sel.x,
            top: Math.max(8, sel.y - 42),
            transform: "translateX(-50%)",
            padding: "7px 13px",
            fontSize: "12.5px",
            fontWeight: 500,
            background: "var(--rf-text)",
            color: "var(--rf-paper)",
            boxShadow: "var(--rf-sheet-shadow)",
            whiteSpace: "nowrap",
          }}
        >
          {tooLong ? COPY.tooLong : COPY.quoteThis}
        </button>
      )}
    </>
  );
}
