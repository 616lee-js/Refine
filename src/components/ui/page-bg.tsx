/**
 * The painted background: the palette's gradient plus a paper grain overlay.
 *
 * The grain is load-bearing, not decoration — it is what makes the surface read
 * as paper rather than as a flat card. Fractal noise, multiply-blended, and
 * `pointer-events: none` so it never intercepts a click.
 *
 * ── Both the image and its opacity come from the palette ──────────────────────
 * The SVG used to be a constant here with Dawn's warm-brown tint baked into its
 * colour matrix, which meant Dusk and Slate would have worn Dawn's grain. It now
 * comes from `--rf-grain-image`, so each palette carries its own tint and its
 * own strength and this component holds no colour at all.
 *
 * Inline SVG rather than an image file: it is ~300 bytes, needs no extra
 * request, and scales without tiling artefacts.
 */

export function PageBg({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative min-h-screen ${className}`}
      style={{
        background: "var(--rf-bg-gradient)",
        backgroundColor: "var(--rf-bg)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "var(--rf-grain-image)",
          opacity: "var(--rf-grain-opacity)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Content sits above the grain. */}
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
