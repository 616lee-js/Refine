import { type ReactNode } from "react";

/**
 * A block notice: something went wrong, or something is worth knowing.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Every screen that needed one drew its own — a rounded box with a hand-mixed
 * rgba fill here, a `text-red-600` paragraph there. They disagreed on radius,
 * padding, size and colour, and none of them followed the palette.
 *
 * ── The tone decides the role, not just the colour ────────────────────────────
 * `error` is announced (`role="alert"`), because it reports a failure the reader
 * has to act on — a save that did not happen, a sign-in that was refused. The
 * other two are `role="status"`: they are context, and interrupting a screen
 * reader mid-sentence to deliver context is worse than letting it arrive in
 * turn.
 *
 * Keep it to one short paragraph. It renders a `<p>`, so it cannot hold a
 * heading or a list, which is deliberate — anything that needs those is a panel,
 * not a notice.
 */

type Tone = "error" | "warn" | "quiet";

const TONES: Record<Tone, { color: string; background: string; ring: boolean }> = {
  error: { color: "var(--rf-error)", background: "var(--rf-error-soft)", ring: false },
  warn: { color: "var(--rf-warn)", background: "var(--rf-warn-soft)", ring: false },
  // Quiet has no tint of its own, so it needs the hairline to read as a block
  // rather than as loose text that happens to be indented.
  quiet: { color: "var(--rf-text-2)", background: "var(--rf-surface)", ring: true },
};

export function Notice({
  tone = "error",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[4px] ${className}`}
      style={{
        margin: 0,
        padding: "9px 13px",
        fontSize: "12.5px",
        lineHeight: 1.55,
        color: t.color,
        background: t.background,
        boxShadow: t.ring ? "inset 0 0 0 1px var(--rf-border)" : "none",
      }}
    >
      {children}
    </p>
  );
}
