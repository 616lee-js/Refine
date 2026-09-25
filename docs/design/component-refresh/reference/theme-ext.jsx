// v3.1 — tokens the repo grew since v3 (error, scrim, per-palette shadow + grain),
// defined for all three palettes × light/dark so each can ship as a user preference.

const SHADOW_LIGHT = (t) => `0 1px 2px rgba(${t},0.04), 0 14px 40px -18px rgba(${t},0.18)`;
const SHADOW_DARK = '0 1px 2px rgba(0,0,0,0.30), 0 14px 40px -18px rgba(0,0,0,0.60)';

const PALETTE_EXTRA = {
  dawn: {
    label: 'Warm paper, early light.',
    light: { error: '#a33a25', errorSoft: 'rgba(163,58,37,0.08)', scrim: 'rgba(40,28,12,0.18)', shadow: SHADOW_LIGHT('40,28,12'), grain: [0.55, 0.45, 0.30] },
    dark:  { error: '#e58a6f', errorSoft: 'rgba(229,138,111,0.13)', scrim: 'rgba(0,0,0,0.45)', shadow: SHADOW_DARK, grain: [0.55, 0.45, 0.30] },
  },
  dusk: {
    label: 'Softer and cooler, for evening writing.',
    light: { error: '#a4372f', errorSoft: 'rgba(164,55,47,0.08)', scrim: 'rgba(26,22,40,0.20)', shadow: SHADOW_LIGHT('30,24,50'), grain: [0.45, 0.40, 0.52] },
    dark:  { error: '#ea8c78', errorSoft: 'rgba(234,140,120,0.13)', scrim: 'rgba(0,0,0,0.50)', shadow: SHADOW_DARK, grain: [0.45, 0.40, 0.52] },
  },
  slate: {
    label: 'Cool paper. No mood at all.',
    light: { error: '#a13a30', errorSoft: 'rgba(161,58,48,0.08)', scrim: 'rgba(15,20,24,0.20)', shadow: SHADOW_LIGHT('15,22,26'), grain: [0.40, 0.44, 0.46] },
    dark:  { error: '#e08a7c', errorSoft: 'rgba(224,138,124,0.13)', scrim: 'rgba(0,0,0,0.45)', shadow: SHADOW_DARK, grain: [0.40, 0.44, 0.46] },
  },
};

function grainUrl([r, g, b]) {
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
}

function palette31Vars(palette, dark) {
  const p = PALETTE_EXTRA[palette] || PALETTE_EXTRA.dawn;
  const x = p[dark ? 'dark' : 'light'];
  return {
    ...window.paletteVars(palette, dark),
    '--rf-error': x.error,
    '--rf-error-soft': x.errorSoft,
    '--rf-scrim': x.scrim,
    '--rf-sheet-shadow': x.shadow,
    '--rf-grain-image': grainUrl(x.grain),
  };
}

function PaletteFrame({ palette = 'dawn', dark = false, style, children }) {
  return <div data-palette={palette} data-mode={dark ? 'dark' : 'light'} style={{ ...palette31Vars(palette, dark), colorScheme: dark ? 'dark' : 'light', position: 'relative', width: '100%', height: '100%', ...style }}>{children}</div>;
}

Object.assign(window, { PALETTE_EXTRA, palette31Vars, PaletteFrame });
