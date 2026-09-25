"use client";

import { PALETTES, type Mode, type Palette } from "@/lib/appearance";
import { Eyebrow } from "./sheet";

/**
 * Choosing the paper.
 *
 * ── Each option renders in its own palette ────────────────────────────────────
 * The preview is wrapped in `<div data-palette={key} data-mode={current}>`, so
 * the CSS blocks in globals.css apply inside it and Dusk is previewed in Dusk
 * rather than in whatever is currently selected. Nothing here hardcodes a
 * colour; the tile is built from the same `--rf-*` names every screen uses,
 * which is the whole reason it looks right in all six combinations.
 *
 * The preview follows the current MODE, though — a palette shown in light while
 * the app is dark would be a picture of something you are not about to get.
 *
 * ── The selection ring stays in the current palette ───────────────────────────
 * Drawn on the button, outside the wrapper, so it reads as part of the page
 * rather than as part of the sample.
 */

const NAMES: Record<Palette, string> = {
  dawn: "Dawn",
  dusk: "Dusk",
  slate: "Slate",
};

/** Supplied by the design package, not placeholders. */
const TAGLINES: Record<Palette, string> = {
  dawn: "Warm paper, early light.",
  dusk: "Softer and cooler, for evening writing.",
  slate: "Cool paper. No mood at all.",
};

function Preview({ palette, mode }: { palette: Palette; mode: Mode }) {
  return (
    <div
      data-palette={palette}
      data-mode={mode}
      aria-hidden="true"
      style={{
        height: 84,
        padding: "14px 14px 0",
        boxSizing: "border-box",
        background: "var(--rf-bg-gradient)",
        backgroundColor: "var(--rf-bg)",
      }}
    >
      {/* A sheet rising off the page, cut off by the tile — the same shape the
          app actually presents. */}
      <div
        style={{
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "10px 12px",
          background: "var(--rf-paper)",
          border: "1px solid var(--rf-paper-edge)",
          borderBottom: "none",
          borderRadius: "3px 3px 0 0",
          boxShadow: "var(--rf-sheet-shadow)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "14px",
            letterSpacing: "-0.01em",
            color: "var(--rf-text)",
          }}
        >
          Refine<span style={{ color: "var(--rf-accent)" }}>.</span>
        </span>
        <span style={{ height: 1, background: "var(--rf-rule)" }} />
        <span style={{ display: "flex", gap: 5 }}>
          <span
            style={{ width: 22, height: 5, borderRadius: 9, background: "var(--rf-accent)" }}
          />
          <span
            style={{ width: 14, height: 5, borderRadius: 9, background: "var(--rf-accent-2)" }}
          />
          <span
            style={{
              width: 30,
              height: 5,
              borderRadius: 9,
              background: "var(--rf-text-4)",
              opacity: 0.6,
            }}
          />
        </span>
      </div>
    </div>
  );
}

export function PalettePicker({
  value,
  mode,
  onChange,
  disabled = false,
}: {
  value: Palette;
  /** The mode the previews render in — the one currently in effect. */
  mode: Mode;
  onChange: (next: Palette) => void;
  disabled?: boolean;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = PALETTES.indexOf(value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(PALETTES[(i + 1) % PALETTES.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(PALETTES[(i - 1 + PALETTES.length) % PALETTES.length]);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Palette"
      onKeyDown={onKeyDown}
      className="grid gap-[10px]"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      {PALETTES.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${NAMES[p]} — ${TAGLINES[p]}`}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(p)}
            className="overflow-hidden rounded-[4px] text-left transition-shadow disabled:opacity-50"
            style={{
              padding: 0,
              background: "var(--rf-paper)",
              boxShadow: on
                ? "0 0 0 1px var(--rf-accent), inset 0 0 0 1px var(--rf-accent)"
                : "inset 0 0 0 1px var(--rf-border)",
            }}
          >
            <Preview palette={p} mode={mode} />

            <div
              style={{
                padding: "10px 12px 12px",
                borderTop: "1px solid var(--rf-border)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16px",
                    color: "var(--rf-text)",
                  }}
                >
                  {NAMES[p]}
                </span>
                {on && (
                  <Eyebrow accent size={8.5}>
                    In use
                  </Eyebrow>
                )}
              </div>
              <p
                className="mt-[3px]"
                style={{
                  fontSize: "11.5px",
                  lineHeight: 1.45,
                  color: "var(--rf-text-3)",
                }}
              >
                {TAGLINES[p]}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
