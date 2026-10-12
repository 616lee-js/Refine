/**
 * One bar per area of life — a reading across categories, not over time.
 *
 * ── Why a line chart is the wrong shape here ──────────────────────────────────
 * The Personal Wellbeing Index is seven separate 0–10 ratings of named areas,
 * averaged into one 0–100 index. A line of that index answers "how satisfied
 * overall" and hides the thing the instrument exists to show: which areas are
 * where. Someone at 70 with community at 3 and relationships at 10 looks
 * identical on a line to someone flat at 7 across the board.
 *
 * So the areas get their own card. The index keeps its line, because movement
 * over time is a real question too — two cards for one instrument, answering two
 * different questions.
 *
 * ── One colour, and the number is the point ───────────────────────────────────
 * No ramp from red to green. A 3 is drawn in exactly the colour an 8 is, and the
 * number beside it says which it is. Colouring a low area as a warning would
 * decide for the reader that it is a problem, which is the same mistake as
 * shading severity bands behind a line — see line-chart.tsx.
 *
 * ── "(was 6)" names its second term ──────────────────────────────────────────
 * It appears only where there is an earlier response and the value has actually
 * changed. A comparison is allowed here precisely because the number it compares
 * to is printed: "lower" would not be, and that rule is in CLAUDE.md.
 */

/**
 * Declared here rather than imported, so this component stands alone like
 * DotMatrix does. src/lib/trends/index.ts has the same shape; they match
 * structurally, which is what TypeScript checks.
 */
export type DomainBar = {
  key: string;
  label: string;
  value: number;
  /** The same area in the previous response, when it exists and differs. */
  previous: number | null;
};

export function DomainBars({
  bars,
  max,
  anchors,
  color = "var(--rf-accent-2)",
}: {
  bars: DomainBar[];
  max: number;
  /** The scale's own words for its ends. A bar at 7 means nothing without them. */
  anchors: [string, string] | null;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      {bars.map((b) => (
        <div
          key={b.key}
          className="grid items-center gap-x-[10px] gap-y-1 sm:grid-cols-[132px_1fr_58px]"
        >
          <span style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}>
            {b.label}
          </span>

          {/* The bar carries no information the row's text does not, so it is
              hidden from screen readers rather than read out twice. */}
          <div
            aria-hidden="true"
            style={{
              height: 13,
              borderRadius: 2,
              boxShadow: "inset 0 0 0 1px var(--rf-rule)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(Math.min(b.value, max) / max) * 100}%`,
                height: "100%",
                borderRadius: 2,
                background: color,
              }}
            />
          </div>

          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--rf-text-2)",
              whiteSpace: "nowrap",
            }}
          >
            {b.value}
            {b.previous !== null && (
              <span style={{ color: "var(--rf-text-4)" }}>
                {" "}
                (was {b.previous})
              </span>
            )}
          </span>
        </div>
      ))}

      {anchors && (
        <div className="mt-[10px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {anchors.map((a) => (
            <span
              key={a}
              className="font-mono uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
