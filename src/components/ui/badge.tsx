import { type ReactNode } from "react";

/**
 * A small mono pill.
 *
 * ── Two families, and they do not mix ─────────────────────────────────────────
 * The product variants read palette tokens, so they move with Dawn, Dusk and
 * Slate and with light or dark.
 *
 * The tier variants are Tailwind stone/yellow/orange/red and stay that way. They
 * belong to admin/safety-log, which is an internal review tool: a tier has to be
 * unambiguous at a glance rather than harmonious with the paper, and admin pins
 * itself to Dawn light anyway. Do not "fix" them to tokens.
 *
 * The `source-claude` variant was removed 2026-07-30 along with its token —
 * nothing in the product is authored by Claude any more, so there is no such
 * source to label.
 */
type BadgeVariant =
  | "tier-0"
  | "tier-1"
  | "tier-2"
  | "tier-3"
  | "status-active"
  | "status-ended"
  | "source-user"
  | "accent"
  | "neutral";

/** Product variants: tokens only. */
const VARIANT_STYLES: Partial<Record<BadgeVariant, React.CSSProperties>> = {
  "status-active": {
    color: "var(--rf-accent-2)",
    background: "var(--rf-accent-2-soft)",
  },
  "status-ended": {
    color: "var(--rf-text-3)",
    background: "var(--rf-surface)",
    boxShadow: "inset 0 0 0 1px var(--rf-border)",
  },
  accent: {
    color: "var(--rf-accent)",
    background: "var(--rf-accent-soft)",
  },
  "source-user": {
    color: "var(--rf-text-3)",
    background: "transparent",
    boxShadow: "inset 0 0 0 1px var(--rf-border)",
  },
  neutral: {
    color: "var(--rf-text-3)",
    background: "transparent",
    boxShadow: "inset 0 0 0 1px var(--rf-border)",
  },
};

/** Admin tier variants: deliberately off-palette. See the note above. */
const TIER_CLASSES: Partial<Record<BadgeVariant, string>> = {
  "tier-0": "bg-stone-100 text-stone-500",
  "tier-1": "bg-yellow-100 text-yellow-700",
  "tier-2": "bg-orange-100 text-orange-700",
  "tier-3": "bg-red-100 text-red-700",
};

export function tierVariant(tier: number): BadgeVariant {
  if (tier === 1) return "tier-1";
  if (tier === 2) return "tier-2";
  if (tier === 3) return "tier-3";
  return "tier-0";
}

export function Badge({
  variant = "neutral",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  const tierClass = TIER_CLASSES[variant];

  return (
    <span
      className={`inline-block rounded-full font-mono uppercase ${tierClass ?? ""} ${className}`}
      style={{
        padding: "2px 8px",
        fontSize: "9px",
        letterSpacing: "0.14em",
        ...(tierClass ? {} : VARIANT_STYLES[variant]),
      }}
    >
      {children}
    </span>
  );
}
