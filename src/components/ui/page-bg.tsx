/**
 * The painted background: Dawn's gradient plus a paper grain overlay.
 *
 * The grain is load-bearing, not decoration — it is what makes the surface read
 * as paper rather than as a flat card. Fractal noise at 40% opacity,
 * multiply-blended, `pointer-events: none` so it never intercepts a click.
 *
 * Inline SVG rather than an image file: it is ~300 bytes, needs no extra
 * request, and scales without tiling artefacts. If it ever shows up in a
 * profile, a pre-generated PNG tile is an acceptable substitute.
 */

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

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
          backgroundImage: GRAIN,
          opacity: "var(--rf-grain-opacity)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Content sits above the grain. */}
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
