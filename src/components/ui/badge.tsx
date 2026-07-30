import { type ReactNode } from "react";

/**
 * NOTE: this component is currently unreferenced. Kept because the tier
 * variants pair with admin/safety-log, which may adopt it.
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
  | "neutral";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  "tier-0": "bg-stone-100 text-stone-500",
  "tier-1": "bg-yellow-100 text-yellow-700",
  "tier-2": "bg-orange-100 text-orange-700",
  "tier-3": "bg-red-100 text-red-700",
  "status-active": "bg-green-50 text-green-600",
  "status-ended": "bg-stone-100 text-stone-400",
  "source-user": "bg-stone-100 text-stone-500",
  neutral: "bg-stone-100 text-stone-500",
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
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
