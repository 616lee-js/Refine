"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { ModeControl } from "@/components/ui/mode-control";
import { PalettePicker } from "@/components/ui/palette-picker";
import type { Mode, Palette } from "@/lib/appearance";

/**
 * Appearance, in Profile.
 *
 * ── It saves on pick, so it is outside the profile form ───────────────────────
 * The three profile fields are typed and then saved with a button. These are
 * not: choosing a palette applies it immediately, and a Save button would sit
 * there implying the change had not happened yet.
 *
 * ── The page changes before the request finishes ──────────────────────────────
 * `document.documentElement.dataset` is written first, so the palette swaps on
 * the click rather than a round trip later. The PATCH follows, and if it fails
 * the dataset is put back and the status line says so — the one thing that
 * must not happen is the page looking changed while the database disagrees.
 *
 * Both values are read back from the server on load rather than guessed from
 * the DOM, so what this shows as selected is what is actually stored.
 */

const COPY = {
  eyebrow: "Preferences",
  lede: "How Refine looks and behaves for you. These save as you change them.",
  appearance: "Appearance",
  appearanceNote: "Every palette has a light and a dark version.",
  palette: "Palette",
  paletteNote: "The paper everything sits on. Applies wherever you're signed in.",
  saved: "Saved",
  failed: "Didn't save",
} as const;

export function Preferences({
  initialPalette,
  initialMode,
}: {
  initialPalette: Palette;
  initialMode: Mode;
}) {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [busy, setBusy] = useState(false);

  async function save(next: { palette?: Palette; mode?: Mode }) {
    const previous = { palette, mode };
    const root = document.documentElement;

    // Optimistic: apply to the page and to local state first.
    if (next.palette) {
      setPalette(next.palette);
      root.dataset.palette = next.palette;
    }
    if (next.mode) {
      setMode(next.mode);
      root.dataset.mode = next.mode;
    }

    setBusy(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      // The result is checked. A failed save that still looked applied would be
      // the worst outcome here: the page one colour, the database another, and
      // the next sign-in silently undoing it.
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setPalette(previous.palette);
      setMode(previous.mode);
      root.dataset.palette = previous.palette;
      root.dataset.mode = previous.mode;
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 44,
        paddingTop: 22,
        borderTop: "1px solid var(--rf-border)",
      }}
    >
      <Eyebrow>{COPY.eyebrow}</Eyebrow>
      <p
        style={{
          margin: "8px 0 16px",
          maxWidth: 460,
          fontSize: "13px",
          lineHeight: 1.6,
          color: "var(--rf-text-3)",
        }}
      >
        {COPY.lede}
      </p>

      <Sheet style={{ padding: "24px 32px 28px" }}>
        <div className="flex items-baseline justify-between gap-4">
          <span style={{ fontSize: "14px", color: "var(--rf-text)" }}>
            {COPY.appearance}
          </span>
          <span
            aria-live="polite"
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color:
                status === "failed" ? "var(--color-error)" : "var(--rf-text-4)",
            }}
          >
            {status === "saved"
              ? COPY.saved
              : status === "failed"
                ? COPY.failed
                : ""}
          </span>
        </div>
        <p
          style={{
            margin: "3px 0 12px",
            fontSize: "11.5px",
            color: "var(--rf-text-4)",
          }}
        >
          {COPY.appearanceNote}
        </p>
        <ModeControl
          value={mode}
          disabled={busy}
          onChange={(m) => void save({ mode: m })}
        />

        <div
          style={{ height: 1, background: "var(--rf-rule)", margin: "24px 0 20px" }}
        />

        <span style={{ fontSize: "14px", color: "var(--rf-text)" }}>
          {COPY.palette}
        </span>
        <p
          style={{
            margin: "3px 0 14px",
            fontSize: "11.5px",
            color: "var(--rf-text-4)",
          }}
        >
          {COPY.paletteNote}
        </p>
        <PalettePicker
          value={palette}
          mode={mode}
          disabled={busy}
          onChange={(p) => void save({ palette: p })}
        />
      </Sheet>
    </div>
  );
}
