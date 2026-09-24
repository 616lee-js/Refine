
/**
 * The archive — the record list with nothing selected.
 *
 * Records are cards in the left column, and a record opens in the main view.
 * This page is that layout before a choice has been made, so the main pane says
 * what the column is for rather than sitting empty.
 *
 * ── No empty state here ───────────────────────────────────────────────────────
 * It used to render one when there were no records, which meant waiting for the
 * whole list to load before this page could draw anything. The list streams in
 * separately now, and it carries its own "nothing here yet" message — so this
 * pane renders immediately and the empty case is stated once rather than twice.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  headline: "[COPY] Everything you've written",
  lede: "[COPY] Every entry, check-in and questionnaire you've recorded. Pick one to read it.",
} as const;

export default function ReflectionsPage() {
  return (
    <>
      <div className="pb-[14px]">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "30px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
          }}
        >
          {COPY.headline}
        </h1>
        <p
          className="mt-[8px] max-w-[440px]"
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--rf-text-3)",
          }}
        >
          {COPY.lede}
        </p>
      </div>
    </>
  );
}
