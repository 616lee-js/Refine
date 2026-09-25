# Component refresh v3.1 — handoff

Synced against `616lee-js/Refine@master` (tree 4c39b03a5451), 2026-09-25.

## Package

- `README.md`: this spec
- `PROMPT.md`: paste into Claude Code
- `Refine - Component refresh v3.1.html`: the design canvas. Open it locally. It has Tweaks for palette and mode.
- `reference/palettes.css`: **all six palette blocks, generated.** Paste this rather than retyping §1.
- `reference/theme.jsx`, `reference/theme-ext.jsx`: the source values palettes.css was generated from
- `reference/atoms.jsx`: exact styles for Toast, Notice, Badge, Input, Btn, PalettePicker, ModeControl, RecordCard
- `reference/screens.jsx`: Profile, Auth, Reflections, Trash, and the component sheet
- `canvas/`: the canvas shell only. Ignore it.

`[COPY]` strings are out of scope — leave them as they are.

## What the audit found

Most of `src/` already reads `--rf-*` tokens. What was still off-system:

| File | Problem | Fix |
|---|---|---|
| `(auth)/login/page.tsx`, `(auth)/signup/page.tsx` | stone-*, rounded-md, text-red-600, no PageBg | Rebuild on PageBg + Sheet (§3) |
| `components/ui/toast.tsx` | `rounded-xl bg-stone-800 text-white shadow-lg` | Ink pill (§4) |
| `components/ui/badge.tsx` | stone/green classes for product variants | Tokens (§4). Leave tier-0…3 alone (admin) |
| `components/ui/section-label.tsx` | `text-stone-400 font-semibold` | `<h2>` around `Eyebrow` |
| `reflections/[id]/read-back.tsx:55` | `rounded-[10px]` + `rgba(163,58,37,.08)` | `<Notice tone="error">` |
| `admin/feedback`, `admin/summary-evals` | same hardcoded rgba | `var(--rf-error-soft)` |
| `ui/journal-guidance-sidebar.tsx:282` | `rgba(40,28,12,0.18)` scrim | `var(--rf-scrim)` |
| `ui/page-bg.tsx` | grain tint hardcoded warm-brown | `var(--rf-grain-image)` |
| `globals.css` | `--rf-sheet-shadow` and `--color-error` Dawn-only | move into palette blocks |

`admin/safety-log` stays on its stone/tier classes by design.

## 1. Palettes in `globals.css`

**Use `reference/palettes.css`.** It contains every block below with full values, including the grain data URLs and the `system` media-query copies. The excerpt below is for orientation.

Keep the current `:root` block as Dawn and add selectors. Every var listed must be set in every block.

```css
:root, [data-palette="dawn"] {
  /* existing Dawn values, plus: */
  --rf-error: #a33a25;
  --rf-error-soft: rgba(163, 58, 37, 0.08);
  --rf-scrim: rgba(40, 28, 12, 0.18);
  --rf-sheet-shadow: 0 1px 2px rgba(40,28,12,.04), 0 14px 40px -18px rgba(40,28,12,.18);
  --rf-grain-image: url("…feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.30  0 0 0 0.18 0'…");
}
[data-palette="dusk"] {
  --rf-bg: #ece6da;
  --rf-bg-gradient: radial-gradient(60% 80% at 82% 12%, #f0d8b8 0%, transparent 45%), radial-gradient(70% 100% at 6% 92%, #c7cbe2 0%, transparent 52%), linear-gradient(180deg, #ece6da 0%, #dad4cc 100%);
  --rf-surface: rgba(255,253,247,0.80); --rf-paper: #fffdf8;
  --rf-paper-edge: rgba(60,50,80,0.10); --rf-rule: rgba(60,50,80,0.08);
  --rf-border: rgba(70,58,48,0.16); --rf-border-strong: rgba(70,58,48,0.32);
  --rf-text: #1a1822; --rf-text-2: #4a4358; --rf-text-3: #857d92; --rf-text-4: #b4adbe;
  --rf-accent: #c07348; --rf-accent-soft: rgba(192,115,72,0.15);
  --rf-accent-2: #5f6ca0; --rf-accent-2-soft: rgba(95,108,160,0.14);
  --rf-warn: #a36a1f; --rf-warn-soft: rgba(163,106,31,0.14);
  --rf-grain-opacity: 0.3;
  --rf-error: #a4372f; --rf-error-soft: rgba(164,55,47,0.08);
  --rf-scrim: rgba(26,22,40,0.20);
  --rf-sheet-shadow: 0 1px 2px rgba(30,24,50,.04), 0 14px 40px -18px rgba(30,24,50,.18);
  --rf-grain-image: /* matrix 0.45 0.40 0.52 */;
}
[data-palette="slate"] {
  --rf-bg: #eeefed;
  --rf-bg-gradient: radial-gradient(90% 70% at 85% 0%, #f6f7f5 0%, transparent 55%), linear-gradient(180deg, #f1f2f0 0%, #e7e9e7 100%);
  --rf-surface: #fafbfa; --rf-paper: #ffffff;
  --rf-paper-edge: rgba(30,40,45,0.10); --rf-rule: rgba(30,40,45,0.08);
  --rf-border: rgba(30,40,45,0.14); --rf-border-strong: rgba(30,40,45,0.28);
  --rf-text: #16191b; --rf-text-2: #464c50; --rf-text-3: #838a8e; --rf-text-4: #b2b8bb;
  --rf-accent: #3f6b6a; --rf-accent-soft: rgba(63,107,106,0.13);
  --rf-accent-2: #7a6a4e; --rf-accent-2-soft: rgba(122,106,78,0.14);
  --rf-warn: #8a6a2a; --rf-warn-soft: rgba(138,106,42,0.13);
  --rf-grain-opacity: 0.28;
  --rf-error: #a13a30; --rf-error-soft: rgba(161,58,48,0.08);
  --rf-scrim: rgba(15,20,24,0.20);
  --rf-sheet-shadow: 0 1px 2px rgba(15,22,26,.04), 0 14px 40px -18px rgba(15,22,26,.18);
  --rf-grain-image: /* matrix 0.40 0.44 0.46 */;
}
```

The grain SVG is the one in `page-bg.tsx`; only the three tint values in the colour matrix change (see `grainUrl()` in `theme-ext.jsx`). In `@theme`: `--color-error: var(--rf-error);`. `--rf-admin*` stays in `:root` only — identical across palettes.

### Dark

Each palette also gets a dark block, keyed on `data-mode`:

```css
[data-palette="dawn"][data-mode="dark"]  { /* PALETTES.dawn.dark  + PALETTE_EXTRA.dawn.dark */ }
[data-palette="dusk"][data-mode="dark"]  { … }
[data-palette="slate"][data-mode="dark"] { … }
@media (prefers-color-scheme: dark) {
  [data-palette="dawn"][data-mode="system"]  { /* same as dawn dark */ }
  [data-palette="dusk"][data-mode="system"]  { … }
  [data-palette="slate"][data-mode="system"] { … }
}
```

The values come from `PALETTES[k].dark` in `theme.jsx` and `PALETTE_EXTRA[k].dark` in `theme-ext.jsx`. In dark, the sheet shadow is the same neutral black for every palette, and the grain keeps its tint. Set `color-scheme: dark` in the dark blocks so native date inputs and scrollbars follow.

The `system` blocks duplicate the dark ones. Either hand-copy them or write a small script that generates `palettes.css` from `theme.jsx`. Just don't let the two drift apart.

The admin layout wraps its tree in `data-palette="dawn" data-mode="light"` so admin tools never change with a user's preference. Tier badges stay as they are.

## 2. The preference

- **Storage:** `users.preferences.palette` (`"dawn" | "dusk" | "slate"`) and `users.preferences.mode` (`"light" | "dark" | "system"`). If absent, the defaults are dawn and light.
- **Defaults:** new accounts and the whole of onboarding stay on Dawn, light. Onboarding doesn't ask about appearance. Sign-in and sign-up always render Dawn, light.
- **API:** `PATCH /api/user/preferences` accepts `palette` and `mode`, and returns 422 for anything else (the same pattern as `guidanceOpen`). On success it also sets the cookies `rf_palette` and `rf_mode`: path `/`, one year, `SameSite=Lax`. They're only display choices.
- **Applying it:** the root `layout.tsx` reads both cookies and renders `<html data-palette={…} data-mode={…}>`. Because it's server-rendered, there's no flash, and `system` resolves in CSS. On login, set the cookies from the stored preferences so a new device picks them up.
- **Switching:** the client updates `document.documentElement.dataset` immediately, then sends the PATCH. If that fails, revert and show the mono status line in the error colour ("Didn't save"). If it succeeds, show the same "Saved" line Profile already uses.

## 3. Screens

**Profile → Preferences** (`settings/profile/profile-form.tsx`). After the Save row, add a new section outside the `<form>`, because it saves on pick rather than on Save. It has a 44px top margin, a 1px `--rf-border` top rule and 22px padding. It holds an `Eyebrow` "Preferences", a 13px/1.6 `--rf-text-3` lede, and then one `Sheet` (padding 24px 32px 28px) with two fields, separated by a 1px `--rf-rule` with 24px above and 20px below:
1. **Appearance:** label 14px `--rf-text`, the aria-live status right-aligned, a note in 11.5px `--rf-text-4`, then `ModeControl`.
2. **Palette:** the same label and note treatment, then `PalettePicker`. Its previews render in the current mode.

**ModeControl** (new, `components/ui/mode-control.tsx`). A segmented `radiogroup` with the options Light, Dark and Match device. The track is a pill: `--rf-surface` with an inset `--rf-border` and 3px padding. Each option is 6px 14px, 12.5px. The selected option is an ink pill (`--rf-text` fill, `--rf-paper` text, weight 500).

**PalettePicker** (new, `components/ui/palette-picker.tsx`). `role="radiogroup"`, 3 equal columns, 10px gap. Each option is a `role="radio"` button, 4px radius, `--rf-paper`, inset 1px `--rf-border`; checked = 1px `--rf-accent` ring inside and out. Top 84px is a preview wrapped in `<div data-palette={key} data-mode={current}>` so it renders in its own palette: bg gradient, a mini sheet with the wordmark (14px), a rule, and three 5px bars (accent, accent-2, text-4). Below, a 1px border then name (Newsreader 16) + "In use" eyebrow (8.5px, accent) when checked, and a one-line tagline (11.5px `--rf-text-3`). Arrow keys move between options.

**Sign in / Sign up.** `PageBg`, centred 380px column. Wordmark 28px, 22px below it a `Sheet` (28px 30px 30px): Newsreader 25/380 heading, signup invite note 12.5px `--rf-text-3`. Fields 14px gap, **visible labels** (12.5px `--rf-text-2`) rather than sr-only. Inputs: 4px radius, `--rf-surface`, inset 1px `--rf-border`, 10px 14px, 14px Geist; focus → `--rf-paper` + inset `--rf-accent`. Invite code: Geist Mono 13px, 0.08em, uppercase. Errors in `<Notice>`. Submit: full-width ink pill, 11px 18px. Footer link 13px `--rf-text-3`, link `--rf-text-2` underlined 3px offset.

## 4. Components

- **Toast:** `rounded-full`, `padding: 9px 16px`, 13px, `background: var(--rf-text)`, `color: var(--rf-paper)`, `box-shadow: var(--rf-sheet-shadow)`. Position, z-50, and timing unchanged.
- **Notice** (new, `components/ui/notice.tsx`): `tone: "error" | "warn" | "quiet"`. 4px radius, `9px 13px`, 12.5/1.55. error = `--rf-error` on `--rf-error-soft` with `role="alert"`; warn = `--rf-warn` on `--rf-warn-soft`; quiet = `--rf-text-2` on `--rf-surface` with inset `--rf-border`. Use it for the read-back decrypt failure, the entry-summary stale note, and the auth errors.
- **Badge:** mono 9px, 0.14em, uppercase, pill, `2px 8px`. `status-active` = accent-2 on accent-2-soft; `status-ended` = text-3 on surface + inset border; `source-user`/`neutral` = text-3, transparent, inset border. Add `accent` = accent on accent-soft. Tier variants unchanged. Then use it for the "Your version" chip in `entry-summary.tsx`, which currently draws its own.
- **SectionLabel:** `<h2 className={className}><Eyebrow>{children}</Eyebrow></h2>`.

## 5. Layout: gutters and the left column

The side padding was too generous, so main content ended up in a narrow strip. Use one gutter everywhere:

- **Gutter:** 20px on the left and right at every breakpoint, `px-5`. It replaces `px-4 sm:px-6` on page containers and `px-6 sm:px-10` in `TopNav`. The wordmark, the left column and page content all start on the same left edge.
- **`reflections/layout.tsx`:** remove `maxWidth: 1440` and `justify-center`. The row runs the full window width and is left-aligned, so on wide screens the left column hugs the left edge instead of drifting toward the middle. The gap is `lg:gap-7` (28px) and the top padding is 20px.
- **Left column (`record-rail.tsx`):** `lg:w-[300px]`, down from 340. The cards fit, and the main view gets the 40px back.
- **Main view:** `flex-1 min-w-0`, with no max-width of its own. The read-back sheet padding goes to `px-10 py-9` (40/36), down from 48/44. Only the entry text is capped, at `max-w-[760px]`, to keep a readable line length. The summary panel and notices use the full width.
- **Single-column pages** (Profile, Trash, and anything else that uses the `maxWidth: 640 | 700` pattern): `maxWidth: 820`, still centred, with the 20px gutter.

Any navigation you move into the left column follows the same rules: it's part of that 300px column, it isn't a second column, and it sits on the 20px left edge.
