// Refine v3 — journaling-first theme.
// The product changed: an entry is the unit of work, not a conversation.
// So the palette re-explores toward PAPER (something you write on) while
// staying warm/encouraging rather than clinical.
//
// Three palettes, one structure. Dawn is the primary.

const PALETTES = {
  dawn: {
    name: 'Dawn',
    tagline: 'Warm paper, early light. Inviting without being sweet.',
    light: {
      bg: '#efe9dd',
      bgGradient: 'radial-gradient(90% 70% at 88% 0%, #f8ecd8 0%, transparent 55%), radial-gradient(80% 80% at 0% 100%, #e6e3d4 0%, transparent 60%), linear-gradient(180deg, #f1ebe0 0%, #e8e2d5 100%)',
      surface: '#fbf7ef',
      paper: '#fffdf7',
      paperEdge: 'rgba(90,70,45,0.10)',
      rule: 'rgba(90,70,45,0.09)',
      border: 'rgba(80,62,40,0.15)',
      borderStrong: 'rgba(80,62,40,0.30)',
      text: '#1e1a14',
      text2: '#514a3e',
      text3: '#8b8377',
      text4: '#b8b1a4',
      accent: '#b0603a',
      accentSoft: 'rgba(176,96,58,0.13)',
      accent2: '#5f7f68',
      accent2Soft: 'rgba(95,127,104,0.14)',
      warn: '#a2701f',
      warnSoft: 'rgba(162,112,31,0.14)',
      grain: 0.4,
    },
    dark: {
      bg: '#161310',
      bgGradient: 'radial-gradient(90% 70% at 88% 0%, #2e2118 0%, transparent 55%), radial-gradient(80% 80% at 0% 100%, #15181a 0%, transparent 60%), linear-gradient(180deg, #171410 0%, #0e0c09 100%)',
      surface: '#1f1b16',
      paper: '#221e18',
      paperEdge: 'rgba(255,240,210,0.08)',
      rule: 'rgba(255,240,210,0.07)',
      border: 'rgba(250,240,220,0.12)',
      borderStrong: 'rgba(250,240,220,0.26)',
      text: '#f2ebdd',
      text2: '#c6bda9',
      text3: '#8a8172',
      text4: '#55503f',
      accent: '#dd8f5e',
      accentSoft: 'rgba(221,143,94,0.15)',
      accent2: '#93b39a',
      accent2Soft: 'rgba(147,179,154,0.14)',
      warn: '#d5a45f',
      warnSoft: 'rgba(213,164,95,0.15)',
      grain: 0.22,
    },
  },

  dusk: {
    name: 'Dusk',
    tagline: 'The Atmosphere palette, carried forward for evening writing.',
    light: {
      bg: '#ece6da',
      bgGradient: 'radial-gradient(60% 80% at 82% 12%, #f0d8b8 0%, transparent 45%), radial-gradient(70% 100% at 6% 92%, #c7cbe2 0%, transparent 52%), linear-gradient(180deg, #ece6da 0%, #dad4cc 100%)',
      surface: 'rgba(255,253,247,0.80)',
      paper: '#fffdf8',
      paperEdge: 'rgba(60,50,80,0.10)',
      rule: 'rgba(60,50,80,0.08)',
      border: 'rgba(70,58,48,0.16)',
      borderStrong: 'rgba(70,58,48,0.32)',
      text: '#1a1822',
      text2: '#4a4358',
      text3: '#857d92',
      text4: '#b4adbe',
      accent: '#c07348',
      accentSoft: 'rgba(192,115,72,0.15)',
      accent2: '#5f6ca0',
      accent2Soft: 'rgba(95,108,160,0.14)',
      warn: '#a36a1f',
      warnSoft: 'rgba(163,106,31,0.14)',
      grain: 0.3,
    },
    dark: {
      bg: '#0d0b14',
      bgGradient: 'radial-gradient(60% 80% at 82% 12%, #462c21 0%, transparent 46%), radial-gradient(80% 100% at 6% 92%, #1e1f4c 0%, transparent 55%), linear-gradient(180deg, #0d0b14 0%, #060509 100%)',
      surface: 'rgba(30,26,42,0.62)',
      paper: '#191527',
      paperEdge: 'rgba(240,234,216,0.09)',
      rule: 'rgba(240,234,216,0.07)',
      border: 'rgba(240,234,216,0.13)',
      borderStrong: 'rgba(240,234,216,0.27)',
      text: '#f0ead8',
      text2: '#c2bba8',
      text3: '#7c7466',
      text4: '#4d4639',
      accent: '#e9b27a',
      accentSoft: 'rgba(233,178,122,0.15)',
      accent2: '#8b95cf',
      accent2Soft: 'rgba(139,149,207,0.14)',
      warn: '#d8a763',
      warnSoft: 'rgba(216,167,99,0.16)',
      grain: 0.2,
    },
  },

  slate: {
    name: 'Slate',
    tagline: 'Cool paper. The most neutral, for people who want no mood at all.',
    light: {
      bg: '#eeefed',
      bgGradient: 'radial-gradient(90% 70% at 85% 0%, #f6f7f5 0%, transparent 55%), linear-gradient(180deg, #f1f2f0 0%, #e7e9e7 100%)',
      surface: '#fafbfa',
      paper: '#ffffff',
      paperEdge: 'rgba(30,40,45,0.10)',
      rule: 'rgba(30,40,45,0.08)',
      border: 'rgba(30,40,45,0.14)',
      borderStrong: 'rgba(30,40,45,0.28)',
      text: '#16191b',
      text2: '#464c50',
      text3: '#838a8e',
      text4: '#b2b8bb',
      accent: '#3f6b6a',
      accentSoft: 'rgba(63,107,106,0.13)',
      accent2: '#7a6a4e',
      accent2Soft: 'rgba(122,106,78,0.14)',
      warn: '#8a6a2a',
      warnSoft: 'rgba(138,106,42,0.13)',
      grain: 0.28,
    },
    dark: {
      bg: '#111314',
      bgGradient: 'radial-gradient(90% 70% at 85% 0%, #1b1f21 0%, transparent 55%), linear-gradient(180deg, #131516 0%, #0b0c0d 100%)',
      surface: '#191c1e',
      paper: '#1c1f21',
      paperEdge: 'rgba(230,240,240,0.08)',
      rule: 'rgba(230,240,240,0.07)',
      border: 'rgba(230,240,240,0.12)',
      borderStrong: 'rgba(230,240,240,0.26)',
      text: '#eaeeef',
      text2: '#b6bcbe',
      text3: '#7d8487',
      text4: '#4b5153',
      accent: '#7fb2ae',
      accentSoft: 'rgba(127,178,174,0.14)',
      accent2: '#c0ab84',
      accent2Soft: 'rgba(192,171,132,0.14)',
      warn: '#c9a35f',
      warnSoft: 'rgba(201,163,95,0.15)',
      grain: 0.2,
    },
  },
};

function paletteVars(palette, dark) {
  const p = PALETTES[palette] || PALETTES.dawn;
  const c = p[dark ? 'dark' : 'light'];
  return {
    '--rf-bg': c.bg,
    '--rf-bg-gradient': c.bgGradient,
    '--rf-surface': c.surface,
    '--rf-paper': c.paper,
    '--rf-paper-edge': c.paperEdge,
    '--rf-rule': c.rule,
    '--rf-border': c.border,
    '--rf-border-strong': c.borderStrong,
    '--rf-text': c.text,
    '--rf-text-2': c.text2,
    '--rf-text-3': c.text3,
    '--rf-text-4': c.text4,
    '--rf-accent': c.accent,
    '--rf-accent-soft': c.accentSoft,
    '--rf-accent-2': c.accent2,
    '--rf-accent-2-soft': c.accent2Soft,
    '--rf-warn': c.warn,
    '--rf-warn-soft': c.warnSoft,
    '--rf-grain-opacity': String(c.grain),
  };
}

function ThemeFrame({ palette = 'dawn', dark = false, style, children }) {
  return (
    <div data-palette={palette} data-mode={dark ? 'dark' : 'light'} style={{ ...paletteVars(palette, dark), width: '100%', height: '100%', position: 'relative', ...style }}>{children}</div>
  );
}

const REFINE_FONT = {
  display: '"Newsreader", "Cormorant Garamond", Georgia, serif',
  body: '"Geist", system-ui, -apple-system, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
};

Object.assign(window, { PALETTES, paletteVars, ThemeFrame, REFINE_FONT });
