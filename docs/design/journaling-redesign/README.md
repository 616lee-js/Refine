# Handoff: Refine — the journaling redesign

## Overview

Refine is an **AI-augmented journaling and reflection tool**. This handoff covers a full redesign  that reframes the product away from its previous conversational shape.

**The change in one line:** the *entry* is the unit of work, not a dialogue. The user writes (or dictates) one continuous journal entry; Refine supplies framework around it and a place to keep it. Refine never converses, never responds mid-entry, and never appears as a character.

Two ways in, both producing entries:

1. **Open reflection** — a blank page. Optional AI "footholds" (generic journaling prompts, or prompts drawn from previous entries and threads) sit in a **collapsible side rail**, offered **once, at the start**. Never inline. Never interrupting.
2. **Framework** — a separate mode the user picks: established questionnaires (GAD-7, PHQ-9) and daily/weekly health & habit trackers. Presented as instruments — one tight, form-like page — without clinical styling.

**Mirror** is the store of what Refine has caught: facts, threads (what keeps coming back), and structured tracker/questionnaire history with charts.

## About the design files

**The files in this bundle are design references created in HTML.** They are prototypes that communicate intended look, layout, and behaviour — they are **not production code to copy**. React + inline styles were used purely so the whole system could be explored in one browsable canvas.

The task is to **recreate these designs inside Refine's existing codebase** (Next.js + Tailwind, per project notes) using its established patterns, component conventions, and libraries. Translate the inline style objects into the codebase's styling approach; do not port `atoms.jsx` verbatim.

If a screen's real behaviour needs to diverge from the mock to fit the codebase, prefer the codebase — but preserve the **intent** notes in the "Non-negotiables" section below.

## Read `ALIGNMENT.md` first

This README was written before the codebase pivot landed. It has since been
verified against `616lee-js/Refine@master` (2026-07-30), and **`ALIGNMENT.md`
is the authority wherever the two disagree.** In particular:

- The user-facing word is **Reflections**, not "Entries" — the repo reserves "journal entry" as a data noun. Rename throughout when implementing.
- The writing surface, the collapsible guidance rail, and safety-at-completion **already exist** upstream and need restyling, not restructuring.
- Safety has a real home: a crisis-resource panel appears inline below the entry, only on Tier 2/3, only at completion. This README does not describe it; `ALIGNMENT.md` does.
- Entry titles, voice, dark mode, foothold content, and trash each need a decision before the screens that depend on them can be built. See `ALIGNMENT.md` §Conflicts.

## Fidelity

**High fidelity.** Colours, typography, spacing, and copy are final-intent, not placeholder. Recreate the UI closely: exact type sizes, exact tokens, exact copy where given. The only deliberately provisional layer is **wording** — the product owner is the source of truth on tone and may revise copy.

Not designed yet (out of scope for this handoff): settings, sign-in/sign-up in this redesign’s styling, framework library/picker, weekly (as opposed to daily) tracker.

---

## Non-negotiables

These are product decisions, not visual preferences. Everything below should survive implementation.

**The anti-essay system.** The hardest UX problem is getting people to *finish* entries without feeling like they're writing essays. Five devices, in order of importance:

1. **A bounded sheet.** The entry sits on a short paper sheet with a visible bottom edge. It must look fillable, never infinite. Do not let the sheet grow into an endless scroll region on first load.
2. **A descriptive norm, not a target.** "Most entries here run three or four sentences. Stop when you've said the true thing." **Never** a word count, progress bar, gauge, or minimum.
3. **Footholds in a collapsible rail.** Offered once, at the start; dismissable wholesale ("Dismiss all · write cold").
4. **Finishing is one cheap button** — "Set it down." No confirmation about length, no "are you sure that's all?".
5. **Voice is an input, not a mode.** A mic pill beside the entry, and a small dictation disc for hands-free. There is no voice "session".

**Strong NOs:**

- No chat bubbles, no "message from Refine", no avatars, no companion voice, no typing indicator.
- No therapy/clinical aesthetics even where the instrument is clinical (no medical blue, no scored-report styling, no risk banners).
- No streaks, badges, or rewards. The habit dot matrix is a **record**, not a score.
- No emoji as UI. No hand-drawn SVG illustration.
- Mirror never shows a diagnosis. Scores get a plain-language reading ("moderate · up 4 since 11 Jul") and nothing more.
- Nothing enters Mirror without explicit user confirmation (Keep / Drop).

---

## Design tokens

### Palette — Dawn (primary, locked)

Warm paper, early light. Terracotta accent, sage secondary. Ship Dawn as the default and only theme unless told otherwise. (Slate and Dusk exist in the mock's theme file as alternates; see "Optional palettes".)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--rf-bg` | `#efe9dd` | `#161310` | App background base |
| `--rf-bg-gradient` | see below | see below | The actual painted background |
| `--rf-surface` | `#fbf7ef` | `#1f1b16` | Secondary panels, tracker strip, callouts |
| `--rf-paper` | `#fffdf7` | `#221e18` | **The sheet.** All content-bearing surfaces |
| `--rf-paper-edge` | `rgba(90,70,45,.10)` | `rgba(255,240,210,.08)` | Sheet border |
| `--rf-rule` | `rgba(90,70,45,.09)` | `rgba(255,240,210,.07)` | Hairlines *inside* a sheet; chart gridlines |
| `--rf-border` | `rgba(80,62,40,.15)` | `rgba(250,240,220,.12)` | Structural dividers, nav borders |
| `--rf-border-strong` | `rgba(80,62,40,.30)` | `rgba(250,240,220,.26)` | Unselected radios, outlined buttons, underlines |
| `--rf-text` | `#1e1a14` | `#f2ebdd` | Entry body, headlines |
| `--rf-text-2` | `#514a3e` | `#c6bda9` | Secondary prose, foothold text |
| `--rf-text-3` | `#8b8377` | `#8a8172` | Guidance copy, inactive nav, eyebrows |
| `--rf-text-4` | `#b8b1a4` | `#55503f` | Norm line, metadata, chart axis labels |
| `--rf-accent` | `#b0603a` | `#dd8f5e` | Terracotta. Active nav underline, primary data, mode eyebrows |
| `--rf-accent-soft` | `rgba(176,96,58,.13)` | `rgba(221,143,94,.15)` | Accent fills, selected onboarding chips |
| `--rf-accent-2` | `#5f7f68` | `#93b39a` | Sage. Positive/secondary data, habit toggles |
| `--rf-accent-2-soft` | `rgba(95,127,104,.14)` | `rgba(147,179,154,.14)` | Sage fills |
| `--rf-warn` | `#a2701f` | `#d5a45f` | Elevated-range indication (used sparingly) |
| `--rf-warn-soft` | `rgba(162,112,31,.14)` | `rgba(213,164,95,.15)` | The GAD-7 chart's elevated band |

**Background gradient (light):**
```css
radial-gradient(90% 70% at 88% 0%, #f8ecd8 0%, transparent 55%),
radial-gradient(80% 80% at 0% 100%, #e6e3d4 0%, transparent 60%),
linear-gradient(180deg, #f1ebe0 0%, #e8e2d5 100%)
```
**Background gradient (dark):**
```css
radial-gradient(90% 70% at 88% 0%, #2e2118 0%, transparent 55%),
radial-gradient(80% 80% at 0% 100%, #15181a 0%, transparent 60%),
linear-gradient(180deg, #171410 0%, #0e0c09 100%)
```

**Paper grain.** A fractal-noise SVG overlay sits above the gradient at `opacity: .4` (light) / `.22` (dark), `mix-blend-mode: multiply`, `pointer-events: none`. It is subtle and load-bearing — it's what makes the surface read as paper rather than as a card. Implementation in the mock (`PageBg` in `reference/atoms.jsx`):
```
url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")
```
A pre-generated PNG tile is an acceptable substitute if the inline SVG is a perf concern.

#### Optional palettes

`reference/theme.jsx` also defines **Dusk** (the previous "Atmosphere" direction — violet/amber, for evening writing) and **Slate** (cool, fully neutral) with complete light + dark ramps. Build against CSS custom properties so a palette switch is a variable swap, but **do not surface a palette picker** in this pass.

### Type

| Family | Source | Used for |
|---|---|---|
| **Newsreader** | Google Fonts (`ital,opsz,wght@0,6..72,200..700;1,6..72,200..700`) | The entry body itself, display, headlines, italic moments |
| **Geist** | Google Fonts (`wght@300..700`) | Interface, buttons, guidance copy, form fields |
| **Geist Mono** | Google Fonts (`wght@400;500`) | Eyebrows, dates, sources, metadata |

Scale, as used:

| Role | Family | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Entry body | Newsreader | 18.5px / 1.62 | 400 | −0.003em |
| Page headline | Newsreader | 27–30px / 1.2 | 380 | −0.02em |
| Hero headline (onboarding, foundation) | Newsreader | 36–42px / 1.08–1.14 | 380 | −0.022 to −0.024em |
| Card / launch title | Newsreader | 22px / 1.2 | 380 | −0.014em |
| Question row (questionnaire) | Newsreader | 16.5px / 1.45 | 400 | — |
| Thread title | Newsreader | 18px | 400 | −0.012em |
| Body / UI | Geist | 12.5–14.5px / 1.5–1.6 | 400–500 | — |
| Button | Geist | sm 12.5 / md 13.5 / lg 14.5 | 500 | — |
| Norm line, metadata prose | Geist | 12px / 1.5 | 400 | — |
| **Eyebrow** | Geist Mono | 9–11px, uppercase | 500 | 0.12–0.20em (0.18em default) |
| Chart axis labels | Geist Mono | 8.5–9px | 400 | 0.06em |

`text-wrap: pretty` on entry paragraphs, headlines, and any prose that wraps.

### Spacing, radius, shadow

- **Radius:** `3px` sheets · `4px` panels, chips-as-cards, step-scale cells · `999px` pills, buttons, radios · `2px` dot-matrix cells.
- **Sheet shadow:** `0 1px 2px rgba(40,28,12,.04), 0 14px 40px -18px rgba(40,28,12,.18)`.
- **Dictation disc shadow:** `0 10px 26px rgba(40,28,12,.14), inset 0 1px 0 rgba(255,255,255,.5)`.
- **Desktop page padding:** 30–40px vertical, 40–46px horizontal.
- **Content max-widths:** entry 620px · framework/check-in 660–720px · read-back 640px · archive 780px · Mirror 900px.
- **Rail widths:** footholds open 306px, collapsed 48px. Home right column 312px.
- **Focus ring:** `outline: 1px solid var(--rf-accent); outline-offset: 2px`.
- Lay out sibling groups with flex/grid + `gap`, not margins.

---

## Screens

Screen source lives in `reference/screens-*.jsx`. Each is a full desktop view at **1200 × 716** inside browser chrome; mobile at **402 × 874**.

### 1. Home — `ScreenHome` (`reference/screens-home.jsx`)

**Purpose:** launchpad first, continuity surface second.

**Layout:** `TopNav`, then a two-column grid `1fr / 312px`, gap 46, padding `34px 46px 0`. Right column has a 1px left border and 30px left padding.

Left column (gap 26):
- **Continuity block.** Eyebrow "Tuesday 28 July · morning". Then a Newsreader 27px/1.34 line, max-width 560: *"You left off wondering whether the tiredness was **the work** or **the wanting**."* (italic on the two phrases). Then Geist 12.5 `--rf-text-3`: "From Sunday's entry. **Read it back**" (underlined link in `--rf-text-2`).
- **Two launch cards**, `1fr 1fr`, gap 18. Each is a `Sheet`, padding `20px 22px 18px`, min-height 168, flex column gap 10, action row pinned to bottom.
  - *Open reflection* (accent eyebrow) — "Write what's there" / "Nothing to answer. Three footholds waiting in the margin if you want a way in." / primary sm button **Begin** + a mic-icon affordance "or speak it".
  - *Framework* (neutral eyebrow) — "GAD-7 · due today" / "Two weeks since the last one. Seven questions, then back to your own words." / primary sm **Start** + underlined "Choose another".
- **`TrackerStrip`** (see §4b) — toggleable.

Right column:
- **Recent** — eyebrow row with "All 148" at right; four rows: mono date (44px column), Newsreader 15px title, small mic glyph if dictated. Framework rows use `--rf-text-2` rather than `--rf-text`.
- **Mirror** — eyebrow row with "3 to confirm"; a Newsreader 14.5px reading ("Anxiety has run higher on weeks with under six hours of sleep"); a 250×78 sparkline; mono caption "GAD-7 · seven readings".

### 2. Open reflection, writing — `ScreenWrite` (`reference/screens-entry.jsx`)

**Purpose:** the core screen. Write one entry and finish it.

**Layout:** `TopNav`, then a row: writing column (flex 1, padding `38px 40px 30px`, contents centred, max-width 620) + `FootholdRail` on the right.

**The sheet** — padding `26px 34px 22px`, `min-height: 330`, flex column:
- **Header row:** accent eyebrow "Open reflection" | mono "Tue 28 Jul · 9:12", 14px bottom padding, 1px `--rf-rule` bottom border.
- **Body:** paragraphs, gap 16, Newsreader 18.5/1.62. Live caret = a 1.5px `--rf-accent` bar, `animation: 1.1s step-end infinite` blink.
- **Footer:** 18px top padding above a `--rf-rule` hairline, containing the **norm line** — Geist 12px `--rf-text-4`, max-width 420: *"Most entries here run three or four sentences. Stop when you've said the true thing."*

**Action bar** below the sheet (margin-top 20): left — `MicPill` ("Speak instead") + mono "Saved 9:14"; right — ghost sm "Keep for later" + primary "Set it down".

**States in the mock:** rail open · rail collapsed · empty (dim placeholder "Start anywhere. A sentence is a whole entry." with caret).

**`FootholdRail`:**
- *Open* — 306px, 1px left border, padding `22px 26px 20px`. Header: eyebrow "Footholds" + "Offered once, at the start. Use one or ignore them all." (Geist 12, max-width 210) + a chevron-right collapse control. Then three items, each separated by a `--rf-rule` top border, padding `15px 0`: a 9.5px source eyebrow (item 1 `--rf-text-4` "Open prompt"; items 2–3 `--rf-accent` — "From Sun 26 Jul", "Thread · Sleep"), the prompt in Newsreader 15.5/1.5 `--rf-text-2`, and an underlined mono "Start here". Pinned to the bottom: mono "Dismiss all · write cold".
- *Collapsed* — 48px: chevron-left, vertical mono "FOOTHOLDS" (`writing-mode: vertical-rl`), and a count badge (18px accent-soft circle).

**Foothold copy (mock content):**
1. Open prompt — "What's taking up the most room in your head right now?"
2. From Sun 26 Jul — "You left off wondering whether the tiredness was the work or the wanting. Any clearer today?"
3. Thread · Sleep — "Third mention of bad sleep this week. What's different about the nights that go well?"

### 3. Open reflection, dictating — `ScreenVoice`

Same sheet, same entry, same rail (collapsed). Voice only changes how words arrive.

- Header label becomes "Open reflection · dictating".
- Interim transcription appears as a dimmed (`--rf-text-3`) paragraph with the caret.
- The sheet footer swaps the norm line for a live row: 26-bar `Waveform` + mono elapsed in accent, and at right the mono note "Transcribing · edit anything after".
- Below the sheet: a **78px `DictationDisc`** with "Listening" (Newsreader 17) and "Pause any time. Nothing is sent until you set it down."; right side outlined sm "Pause" + primary "Set it down".

### 4. Framework session — `ScreenFramework` (`reference/screens-framework.jsx`)

**Purpose:** complete a standard instrument quickly. GAD-7 shown; PHQ-9 is the same component with different items.

**Layout:** centred, max-width 720, padding `22px 40px 0`. Header row: accent eyebrow "Framework · GAD-7", Newsreader 27px "Generalised anxiety", Geist 13 `--rf-text-3` "Seven questions. Under two minutes. Answer roughly — precision isn't the point." At right, stacked: an accent-soft chip "Every 2 weeks" and mono "Last taken 14 Jul".

**The sheet** (padding `14px 30px 18px`):
- **`ScaleHeader`** — grid `1fr / 260px`. Left: mono eyebrow "Over the last two weeks". Right: four 8.5px mono column labels, centred — Not at all · Several days · Over half the days · Nearly every day. 1px `--rf-border` bottom.
- **Seven `ScaleRow`s** — grid `1fr / 260px`, padding `6px 0`, `--rf-rule` separators (none on last). Left: a 2-digit mono index in `--rf-text-4`, then the item in Newsreader 16.5/1.45. Right: four 17px radio circles, evenly distributed in a 4-column grid so every row's options align under the shared header. Selected = filled `--rf-accent` with a 5px paper-coloured dot.
- **Optional free text** — above a `--rf-border` rule: mono "In your own words · optional", then Newsreader 16.5 *italic* `--rf-text-3` with caret, then a `MicPill`.

**Footer row:** Geist 12 `--rf-text-4` "Scored and kept in Mirror. You'll see the trend over time — never a diagnosis." | ghost sm "Finish later" + primary "Record answers".

**Scoring:** 0–3 per item, sum 0–21 for GAD-7 (PHQ-9: 9 items, 0–27). Store the raw item responses, not just the total. Never render a severity label as a verdict — the plain-language reading belongs to Mirror.

### 4b. Tracker check-in — `ScreenCheckin` + `TrackerStrip`

**Placement is now decided in the mock but worth confirming:** both exist. `TrackerStrip` is the Home version (a 15-second inline strip); `ScreenCheckin` is the full ritual version.

**`ScreenCheckin`** — centred, max-width 660. Header: accent eyebrow "Daily check-in", Newsreader 30px "Tuesday, 28 July", "Four taps. Then write, or don't."; at right mono "19 of 21 days logged" (a count of what happened, deliberately *not* a streak).

Sheet rows (`150px / 1fr` grid, `--rf-rule` separators):
- **Slept** ("Hours, roughly") — Newsreader 26px value, −/+ 28px square steppers, and a neutral chip "2h under your median".
- **Mood** ("Now, not the whole day") — `StepScale`: five 34×30 cells, radius 4; selected fills `--rf-accent`; end labels Low / Even / Good in 9px mono.
- **Energy** — same scale, labels Empty / Fine / Full.
- **Kept up** ("Tap what happened") — pill toggles with a 13px checkbox; **on** uses `--rf-accent-2` + `--rf-accent-2-soft`. Items: Medication, Moved, Outside, Alcohol, Screens after 11.

**Footer:** "Feeds the trends in Mirror. No streaks, no reminders unless you ask." | outlined sm "Log and stop" + primary "Log, then write".

**`TrackerStrip`** (Home) — one `--rf-surface` row, padding `15px 20px`, radius 4: a "Check-in / 15 seconds" label block, a 1px divider, then Slept (value), Mood (five 20px cells), Kept up (three pills), and an outlined sm **Log** at the far right.

### 5. Session complete — `ScreenComplete`

**Purpose:** close the entry and confirm what Mirror may keep.

Centred, max-width 640, padding `54px 40px 0`. Accent eyebrow "Set down · 9:19". Newsreader 36px/1.12 title with the object italicised: *On not wanting the promotion*. Then "Titled for you. **Rename it** if that's wrong."

**Caught for the Mirror** — eyebrow row with mono "Nothing is kept unless you say so" at right. Three `MirrorCatch` rows (`--rf-rule` top border, padding `14px 0`): a 9.5px kind eyebrow (Fact / Thread · Sleep / Pattern), the caught statement in Newsreader 16/1.5, and two pill actions at right — **Keep** (`--rf-accent-2` on `--rf-accent-2-soft`) and **Drop** (outlined, `--rf-text-3`).

**Footer** above a `--rf-border` rule: Newsreader 16 italic `--rf-text-3` "That's enough for today." | outlined sm "Read it back" + primary "Done".

### 6. Entries archive — `ScreenList` (`reference/screens-home.jsx`)

Centred, max-width 780. Header: eyebrow "148 entries · since March", Newsreader 30px "Everything you've set down"; right — four filter pills (All / Open / Framework / Check-ins); the active pill is solid `--rf-text` with paper text, the rest outlined.

Sheet rows, grid `64px / 1fr / 96px`, padding `14px 0`, `--rf-rule` separators: a date block (Newsreader 20px day + mono month), then title (Newsreader 17.5, `--rf-text` for open entries and `--rf-text-2` for framework/check-in rows) with a mic glyph if dictated and a single-line ellipsised excerpt beneath (Geist 12.5 `--rf-text-3`), then a right-aligned kind chip (Framework chips are accent-soft; others outlined). Below the sheet, a centred mono "Earlier in July" marks the next page. Paginate or infinite-scroll as the codebase prefers.

### 7. Single entry read-back — `ScreenRead`

Centred, max-width 640. Above the sheet: mono "← Entries" and Prev / Next (Next in accent).

Sheet (padding `30px 38px 26px`): header row accent eyebrow "Open reflection · dictated" | mono "Tue 28 Jul · 9:12–9:19". Newsreader 28px title with italic object. Mono provenance line: "Started cold · no foothold used" (or which foothold was used). Then the entry paragraphs at full 18.5px — **the user's words are never shrunk on read-back**. Footer above a `--rf-rule`: mono "Kept in Mirror" followed by chips (Fact · promotion, Thread · sleep, Pattern · deflection).

Below the sheet: "Play the recording · 7:02" | ghost sm "Delete" + outlined sm "Add to this entry".

### 8. Mirror — `ScreenMirror` (`reference/screens-mirror.jsx`)

Centred, max-width 900, padding `24px 46px 0`. Header: accent eyebrow "Mirror", Newsreader 27px "What Refine has of you", Geist 13 "Everything here came from your own entries and check-ins. Confirm it, correct it, or take it out."; outlined sm "Export everything" at right. Then tabs — **Threads · Facts · Trends** — Geist 13.5, active in `--rf-text` 500 with a 1px `--rf-accent` underline over the `--rf-border` rule.

**Trends tab.** A 2-column grid of `ChartCard`s (gap 14), each a `Sheet` (padding `14px 20px 13px`) with: eyebrow label, a big Newsreader 27px reading, a Geist 12.5 plain-language note, and a right-aligned mono meta line (max-width 130).
- Anxiety · GAD-7 — **12**, "moderate · up 4 since 11 Jul", "7 readings · fortnightly". Chart has a `--rf-warn-soft` band from 10 to max (21) marking the elevated range.
- Low mood · PHQ-9 — **9**, "mild · down 5 since June". Sage line, max 27.
- Sleep · hours — **5.5**, "median 6.2 over 21 days", "From daily check-ins". Sage line, max 9.
- Entries written — **19**, "of the last 21 days", "Recorded, not rewarded".

Then, full width: **Kept up · last 21 days** — a `DotMatrix` of five habit rows × 21 days. 13px cells, radius 2, `gap 4`; filled = `--rf-accent`, partial = same at 42% opacity, empty = `inset 0 0 0 1px var(--rf-border)`. Meta: "Two of five things drift on the weeks anxiety runs high." Finally a **Plainly** sheet: a Newsreader 18/1.6 paragraph describing the pattern in prose, and a Geist 12.5 `--rf-text-4` disclaimer: "A description of what you logged, not a diagnosis. Bring it to someone qualified if it looks worth acting on."

**`LineChart` spec:** padding `l26 r8 t10 b18`; 4 horizontal gridlines in `--rf-rule` with 9px mono value labels at the left; area fill at 10% of the line colour; 1.6px line, round joins; 2.2px point markers (paper fill, coloured stroke), last point 3.4px and solid. Any charting library is fine as long as it reproduces this restraint — no legends, no tooltips-by-default, no axis titles, no rounded "card" chart chrome.

**Threads tab.** Grid `1fr / 320px`, gap 40.
- Left: eyebrow "Threads · what keeps coming back" with "Sorted by recency" at right; rows (`--rf-rule` top border, padding `13px 0`) each pairing a Newsreader 18px title with a mono "N entries · last <date>" and a Newsreader 15.5/1.55 `--rf-text-2` summary. Mock threads: Sleep (11), The promotion (6), Dad (9), Evenings (7).
- Right (1px left border, 28px padding): an `--rf-accent-soft` callout — "3 waiting on you" / "Refine caught these today but won't keep them until you confirm." Then **Facts**: rows of Geist 13 statement + mono provenance ("From 8 entries", "Confirmed 14 Jun", "Observed") with a mono **Edit** affordance at right.

### 9. Onboarding step 2 — `ScreenOnboarding`

Two equal columns, 1px divider, padding `54px 50px`.

Left: wordmark top; centred block with eyebrow "Step 2 of 3" and a Newsreader 40px/1.14 headline — "Two ways in. Both are *writing*." Then two labelled explanations (accent 9.5px eyebrows, Newsreader 16.5/1.6 body) for **Open reflection** and **Framework**. Pinned at the bottom, Geist 12 `--rf-text-4`: "Refine is not a therapist and not a chatbot. It reads what you write so it can ask better questions next time."

Right: eyebrow "Choose what to keep track of", a 13px lede ("Pick as few as you like. You can change all of this later, and skipping a day costs nothing."), then a 2×3 grid of `PickChip`s — radius 4, Newsreader 16 label + Geist 11.5 sub; selected = `--rf-accent-soft` with a 1px accent inset ring. Items: Anxiety (GAD-7 · fortnightly) · Low mood (PHQ-9 · fortnightly) · Sleep (Daily, one number) · Medication (Daily, one tap) · Movement · Alcohol — first four on. Then primary "Continue" + a plain "Skip — just let me write".

### Mobile — `MobileWrite`

402 × 874. A slim top bar (mono "Close" | wordmark | accent "Set down"), the sheet filling the remaining height with a 14px gutter, the norm line shortened to "Three or four sentences is a full entry.", then a **peeking footholds sheet** (drag handle, "Footholds" + count, first prompt visible) docked above a bottom bar carrying the `MicPill` and a mono "Saved". Both writing and dictating states are in the mock.

---

## Components to build

Names from the mock (`reference/atoms.jsx` unless noted). Rename to fit codebase conventions.

| Component | Notes |
|---|---|
| `PageBg` | Gradient + grain + column layout wrapper |
| `TopNav` | Wordmark, Today / Entries / Mirror, avatar |
| `Sheet` | The paper. **Must grow with content** — the inner wrapper is `flex: 1 1 auto`, not `height: 100%` (this caused clipping in the mock; don't repeat it). Optional `ruled` prop draws 30px ruling |
| `Eyebrow` | Mono, uppercase, tracked. `size` + `color` props |
| `Wordmark` | "Refine" + accent period |
| `Btn` | `primary` / outlined / `ghost` × `sm` `md` `lg`, all radius 999. `accent` prop makes primary terracotta instead of ink |
| `Field` | Pill text input on paper |
| `Chip` | Mono uppercase tag; `soft` + `accent` variants |
| `MicPill` | Idle and recording states (waveform + elapsed + Done) |
| `DictationDisc` | 64–108px; breathing ring at 3.4s when listening |
| `Waveform` | N bars, staggered `scaleY` animation, ~0.9–1.5s each |
| `EntryParagraph` | Newsreader 18.5/1.62, `dim` + `caret` props |
| `NormLine` | The anti-essay norm |
| `FootholdRail` | Open (306px) / collapsed (48px) |
| `ScaleHeader` + `ScaleRow` | Questionnaire header and item rows |
| `StepScale`, `HabitToggles`, `CheckRow` | Check-in controls (`screens-framework.jsx`) |
| `LineChart`, `DotMatrix` | Mirror charts |
| `ChartCard` | Label + reading + note + meta + chart |
| `MirrorCatch` | Keep / Drop confirmation row |
| `TrackerStrip`, `LaunchCard`, `RecentRow`, `ArchiveRow` | Home + archive (`screens-home.jsx`) |
| `ThreadRow`, `FactRow`, `MirrorTabs` | Mirror lists (`screens-mirror.jsx`) |
| `PickChip` | Onboarding multi-select |

## Interactions & behaviour

- **Entry autosave** — continuous; surfaced as the quiet mono "Saved 9:14". No spinner, no toast.
- **Foothold selection** — tapping "Start here" seeds the entry (or inserts the prompt as a first line, your call) and collapses the rail. Footholds are **not** re-offered later in the session.
- **Rail collapse** — animate width 306 ↔ 48; the writing column reflows. Remember the user's preference across sessions.
- **Dictation** — interim transcript renders dim; finalised text promotes to full weight. Everything stays editable afterwards. Pause/resume, never a modal.
- **Set it down** → the complete screen. No length validation. Zero-length entries just discard silently.
- **Mirror Keep/Drop** — optimistic; the row settles out of the list. Dropped items are never re-proposed.
- **Questionnaire** — no required-field blocking; "Finish later" preserves partials. Selecting a radio doesn't auto-advance (the whole point is one page).
- **Animations** — caret blink 1.1s step-end; waveform bars 0.9–1.5s ease-in-out staggered ~50ms; dictation ring 3.4s breath. Everything else: 150–220ms ease. Respect `prefers-reduced-motion` — drop the waveform and ring animations to static.
- **Hover** — links and mono affordances go to `--rf-text`; buttons lift ~4% in background luminance; nothing scales or bounces.
- **Responsive** — below ~900px the foothold rail becomes the mobile peeking sheet; Home's right column moves beneath the launch cards; Mirror's chart grid goes single-column.

## State

Per entry: `id`, `kind` (`open` | `framework` | `checkin`), `startedAt`, `setDownAt`, `body`, `inputMode` (`text` | `voice`), `footholdUsed` (id or null), `title` (AI-generated, user-editable), `mirrorCandidates[]` (each `{kind, text, status: pending|kept|dropped}`).

Per framework response: `instrument` (`gad7` | `phq9`), `items[]` (raw 0–3), `total`, `note`, `takenAt`.

Per check-in: `date`, `sleepHours`, `mood` 1–5, `energy` 1–5, `habits{}` booleans.

UI state: `railCollapsed` (persisted), `dictationStatus`, `mirrorTab`, `archiveFilter`.

Mirror derives threads and readings server-side; the client renders them.

## Assets

None. No images, no icon set — every glyph in the mock is inline SVG (mic, chevrons, checkmark) drawn with `currentColor` and 1.4–1.6px strokes. Substitute the codebase's existing icon library if it has close equivalents at those weights. Fonts come from Google Fonts; self-host if the codebase already does.

## Files in this bundle

| File | What it is |
|---|---|
| `Refine - journaling redesign.html` | **Start here.** The full canvas — all 16 artboards, with tweak controls for palette, light/dark, foothold default, and tracker placement |
| `reference/theme.jsx` | Dawn / Dusk / Slate palettes, `ThemeFrame`, `REFINE_FONT` |
| `reference/atoms.jsx` | Shared components and the grain/animation definitions |
| `reference/screens-entry.jsx` | `ScreenWrite`, `ScreenVoice`, `MobileWrite`, `FootholdRail`, `NormLine` |
| `reference/screens-framework.jsx` | `ScreenFramework` (GAD-7), `ScreenCheckin`, `ScreenComplete` |
| `reference/screens-home.jsx` | `ScreenHome`, `ScreenList`, `ScreenRead`, `TrackerStrip` |
| `reference/screens-mirror.jsx` | `ScreenMirror` (trends / threads), `ScreenOnboarding` |
| `reference/app.jsx` | Canvas composition — the authoritative list of screens and states |
| `design-canvas.jsx`, `browser-window.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx` | Presentation scaffolding for the canvas. **Not part of the design** — ignore when implementing |
| `ALIGNMENT.md` | **Read after this file.** How the design maps onto the real repo: agreements, net-new work, five conflicts to decide, and the `globals.css` token mapping |
| `PROMPT.md` | A ready-to-paste brief for Claude Code |

To view the canvas, serve the folder over HTTP (`npx serve`) and open `Refine - journaling redesign.html` — the fonts and JSX files won't load from `file://`.
