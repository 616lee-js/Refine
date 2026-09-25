/**
 * Palette and mode — the two display choices.
 *
 * ── Why they are cookies as well as stored preferences ────────────────────────
 * The database row is the truth; the cookies are how the server knows which
 * palette to paint before it has looked anything up. The root layout runs for
 * every request including signed-out ones, and reading the user's row there
 * would mean a database call on every page load to decide a colour.
 *
 * The cost of that trade is that the cookies can fall out of step — cleared,
 * or set on one device and not another. Login rewrites both from the stored
 * preferences, which is the moment that matters, and a stale cookie is a
 * wrong colour rather than wrong data.
 *
 * ── Not httpOnly, deliberately ────────────────────────────────────────────────
 * The picker sets `document.documentElement.dataset` the instant you choose, so
 * the change is visible before the request lands. These say nothing about the
 * person beyond which of three palettes they like.
 */

export const PALETTES = ["dawn", "dusk", "slate"] as const;
export const MODES = ["light", "dark", "system"] as const;

export type Palette = (typeof PALETTES)[number];
export type Mode = (typeof MODES)[number];

/** New accounts, signed-out screens, and anything that has not chosen. */
export const DEFAULT_PALETTE: Palette = "dawn";
export const DEFAULT_MODE: Mode = "light";

export const PALETTE_COOKIE = "rf_palette";
export const MODE_COOKIE = "rf_mode";

/** A year. It is a display choice; there is nothing to expire it for. */
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const APPEARANCE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: APPEARANCE_COOKIE_MAX_AGE,
  sameSite: "lax",
} as const;

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Anything unrecognised falls back rather than being rendered into an attribute. */
export function readPalette(value: unknown): Palette {
  return isPalette(value) ? value : DEFAULT_PALETTE;
}

export function readMode(value: unknown): Mode {
  return isMode(value) ? value : DEFAULT_MODE;
}
