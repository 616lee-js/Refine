"use client";

import { MODES, type Mode } from "@/lib/appearance";

/**
 * Light, Dark, or follow the device.
 *
 * ── A radiogroup, not three buttons ───────────────────────────────────────────
 * Exactly one is always chosen, and choosing one unchooses the others. Marked up
 * that way so a screen reader announces "2 of 3" rather than reading three
 * unrelated controls, and so arrow keys move between them.
 *
 * ── "Match device" is not resolved here ───────────────────────────────────────
 * It is stored as `system` and answered in CSS by a prefers-color-scheme block,
 * so it follows the OS without a reload and without this component knowing
 * anything about the device.
 */

const LABELS: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
  system: "Match device",
};

export function ModeControl({
  value,
  onChange,
  disabled = false,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
  disabled?: boolean;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = MODES.indexOf(value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(MODES[(i + 1) % MODES.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(MODES[(i - 1 + MODES.length) % MODES.length]);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      onKeyDown={onKeyDown}
      className="inline-flex rounded-full"
      style={{
        padding: 3,
        gap: 2,
        background: "var(--rf-surface)",
        boxShadow: "inset 0 0 0 1px var(--rf-border)",
      }}
    >
      {MODES.map((m) => {
        const on = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            // Only the selected option is in the tab order; arrow keys move
            // within the group. That is how a radiogroup is meant to behave,
            // and it stops three stops appearing in the tab sequence.
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(m)}
            className="rounded-full transition-colors disabled:opacity-50"
            style={{
              padding: "6px 14px",
              fontSize: "12.5px",
              fontWeight: on ? 500 : 400,
              color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
              background: on ? "var(--rf-text)" : "transparent",
            }}
          >
            {LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}
