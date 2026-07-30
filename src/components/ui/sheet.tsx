/**
 * The paper. Every content-bearing surface in the app sits on one.
 *
 * ── The trap ──────────────────────────────────────────────────────────────────
 * The inner wrapper is `flex: 1 1 auto`, NOT `height: 100%`. This bit the
 * design prototype: `height: 100%` resolves against the sheet's own height and
 * clips content instead of letting the sheet grow with it. `flex: 1 1 auto`
 * fills available space when there is some and grows when there isn't.
 *
 * ── Bounded by default ────────────────────────────────────────────────────────
 * `minHeight` gives the sheet a visible bottom edge on first load. That edge is
 * the first and most important device in the anti-essay system: the page has to
 * look fillable, never infinite. Do not let a sheet become an endless scroll
 * region.
 */

export function Sheet({
  children,
  className = "",
  minHeight,
  ruled = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** e.g. 330 for the writing sheet. Omit for content-sized sheets. */
  minHeight?: number;
  /** Draws 30px ruling, like lined paper. */
  ruled?: boolean;
  as?: "div" | "article" | "section";
}) {
  return (
    <Tag
      className={`flex flex-col ${className}`}
      style={{
        background: "var(--rf-paper)",
        border: "1px solid var(--rf-paper-edge)",
        borderRadius: "var(--radius-sheet, 3px)",
        boxShadow: "var(--rf-sheet-shadow)",
        ...(minHeight ? { minHeight: `${minHeight}px` } : {}),
        ...(ruled
          ? {
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent, transparent 29px, var(--rf-rule) 29px, var(--rf-rule) 30px)",
            }
          : {}),
      }}
    >
      {/*
        Written as an explicit style, not `flex-1`: Tailwind's flex-1 compiles
        to `flex: 1 1 0%`, and a zero basis makes the wrapper ignore its own
        content height when sizing — the same clipping the `height: 100%`
        version caused. `1 1 auto` is the requirement; spelling it out means no
        utility-ordering accident can quietly change it.
      */}
      <div className="flex flex-col" style={{ flex: "1 1 auto" }}>
        {children}
      </div>
    </Tag>
  );
}

/**
 * Mono, uppercase, tracked. Labels a section without competing with it.
 */
export function Eyebrow({
  children,
  accent = false,
  size = 10,
  className = "",
}: {
  children: React.ReactNode;
  accent?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-mono uppercase ${className}`}
      style={{
        fontSize: `${size}px`,
        letterSpacing: "0.18em",
        fontWeight: 500,
        color: accent ? "var(--rf-accent)" : "var(--rf-text-3)",
      }}
    >
      {children}
    </span>
  );
}
