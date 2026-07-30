# Paste this into Claude Code

Run from the root of the Refine repo, after unzipping this package to `docs/design/journaling-redesign/`.

Verified against `616lee-js/Refine@master` on 2026-07-30, after the core-workflow pivot landed.

---

I'm restyling and extending Refine against a completed design. The design lives in `docs/design/journaling-redesign/`.

**Read these three files in full before writing any code:**
1. `docs/design/journaling-redesign/README.md` — the design spec. Tokens, type, every screen, component inventory, interaction and state models.
2. `docs/design/journaling-redesign/ALIGNMENT.md` — how the design maps onto **this** codebase: what already agrees, what's net-new, and five conflicts that need decisions rather than implementations.
3. `docs/design/journaling-redesign/reference/theme.jsx` — exact palette values.

Then read the `reference/screens-*.jsx` file for whichever screen you're about to build.

The HTML/JSX in that folder is a **design reference, not code to port** — it's React with inline style objects because it was built to be browsable as one canvas. Recreate the designs here using this codebase's patterns: Tailwind v4 via the `@theme` layer in `src/app/globals.css`, App Router, server components where they already are. Ignore `design-canvas.jsx`, `browser-window.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx` entirely — presentation scaffolding.

**Good news about scope.** The pivot you already shipped got the structure right. `journal-entry.tsx` has no AI in the surface; `journal-guidance-sidebar.tsx` is already a collapsible 20rem rail that structurally cannot read the entry; safety classification already runs only at completion and stays invisible below Tier 2/3. So most of this work is **restyling into a warm-paper palette plus building the framework/tracker/trends surfaces that don't exist yet** — not restructuring.

**Follow the repo's vocabulary, not the design's.** The design says "Entries"; this codebase deliberately uses **Reflections** as the user-facing word and reserves "journal entry" as the data noun. Nav stays Reflections · Mirror · Profile. Routes stay `/reflection/[id]` for writing and `/reflections/[id]` for reading.

**Before Step 1, answer these five questions from ALIGNMENT.md and wait for me.** Don't build past them:

1. **Foothold content** — the repo's guidance is practice guidance that never asks for a reply; the design's footholds are questions drawn from previous entries. ALIGNMENT.md §Conflicts 2 lays out three options and recommends one. Which do we ship in v1?
2. **Entry titles** — the design's complete screen and archive both show AI-generated titles. There's no title column and Cabinet 2 summaries are explicitly not surfaced in v1. Add a user-editable title, derive an excerpt at render, or hold?
3. **Dark mode** — Dawn has full light and dark ramps; the app is light-only today. In scope?
4. **Voice** — build the components and gate behind the existing flag, or skip for now?
5. **Trash** — design it properly, or minimally restyle the existing screen?

**Then work in this order, stopping after each step.**

**Step 1 — Tokens and type.** Repoint `src/app/globals.css` at Dawn, keeping the existing semantic role names so current styles keep working (mapping table in ALIGNMENT.md). Add the tokens Dawn needs that have no equivalent. Delete the dead `--color-source-claude-*` block. **Leave `--color-tier-*` alone** — `admin/safety-log` is an internal tool and stays as it is. Load Newsreader / Geist / Geist Mono in `layout.tsx`. Then build `PageBg` (gradient + paper grain) and `Sheet`.

One trap: `Sheet`'s inner wrapper must be `flex: 1 1 auto`, **not** `height: 100%` — the latter clips content instead of growing. This bit the prototype.

Show me a page with a sheet on the background before going further.

**Step 2 — The writing surface.** Restyle `journal-entry.tsx` and `journal-guidance-sidebar.tsx` into the design's `ScreenWrite` + `FootholdRail`. Preserve every behaviour that's already there: 1500ms debounced autosave, the `sendBeacon` flush on unload, the `aria-live` save states and their exact error copy, the persisted `guidanceOpen` preference, the inline two-step "Move to trash?" confirm, and the sidebar's structural inability to read the entry.

Add the anti-essay layer: the bounded sheet with a visible bottom edge, and the norm line under the entry — "Most entries here run three or four sentences. Stop when you've said the true thing." No word count, no progress bar, no minimum. The finish button becomes **"Set it down"**, and keeps its current two-state behaviour ("Save changes" once completed, re-running classification).

Give `CrisisResourcePanel` a Dawn treatment in its existing position and trigger. It must not read as a clinical alert.

**Step 3 — Framework mode.** Create `src/lib/questionnaires/` with `gad7.ts` (questions, response options, scoring, a version string), then build `ScreenFramework`: `ScaleHeader` + seven `ScaleRow`s with radio columns aligned under shared labels, plus the optional free-text note. Persist to `questionnaire_responses` — raw answers *and* scoring, both encrypted; nullable `completed_at` gives you "Finish later" for free. No severity verdict on this screen; no clinical styling. Remember PHQ-9 item 9 is a safety item and routes through `safety_log` with `source = "questionnaire"`.

**Step 4 — Check-in.** `daily_checkin` as an instrument definition, then `ScreenCheckin` with `StepScale` and `HabitToggles`. Replace the disabled "Coming soon" stub on Home with the real entry point.

**Step 5 — Home, archive, read-back.** `ScreenHome` (continuity line, two launch cards, tracker strip, Recent + a Mirror sparkline), then `reflections/page.tsx` and `reflections/[id]/page.tsx`. On read-back the user's words stay at full 18.5px — never shrink them. The archive depends on the titles decision; if we derive excerpts, note that each one is a decryption and should write `content_access_log`.

**Step 6 — Mirror.** Restyle `mirror/page.tsx` for Facts and Threads (mapping `memory_kind` `fact` and `thread`), with the confirm callout — `last_confirmed_at NULL` + `is_active` means proposed, so Keep/Drop already has a data model. Drop is a hard delete; make sure extraction never re-proposes a dropped item. Then build the net-new **Trends** tab: four `ChartCard`s, the habit `DotMatrix`, and the "Plainly" prose reading. Trends decrypt N rows and aggregate in app code — scoring is encrypted, so SQL aggregation isn't available. Match the `LineChart` restraint in the README: no legends, no default tooltips, no axis titles, no card chrome. Never show a diagnosis; a plain-language reading only.

**Step 7 — Onboarding**, whose copy is still pre-pivot, then a responsive pass. Below `lg` the guidance rail already overlays — keep that; the design's mobile peeking sheet is the same idea if you prefer it. Home's right column moves under the launch cards; Mirror's charts go single-column.

**Hold these throughout:**
- Nothing reads the entry while it's being written. The guidance rail must keep having no prop through which the body could reach it.
- No chat bubbles, no avatars, no companion voice, no "message from Refine". Nothing in the product is authored by Claude any more.
- No clinical or therapy aesthetics, even on the questionnaires and even on the crisis panel.
- No streaks, badges, rewards, or "you haven't written in a while". The dot matrix is a record, not a score. This is a hard product rule — `guidance.ts` already states it.
- No emoji as UI. No decorative illustration. Icons are thin inline SVG on `currentColor`.
- The user's words are the primary voice on every screen: Newsreader, full size, unadorned.
- `text-wrap: pretty` on prose. Sibling groups laid out with flex/grid + `gap`.
- Respect `prefers-reduced-motion` — waveform and breathing ring go static. `globals.css` already has a reduced-motion block.

Design copy is provisional but considered — use it as written and flag anything you think is wrong rather than rewriting it. The existing code's copy is often better; where they differ, say so and let me pick.

Ask before adding any screen or section not in the handoff. Settings, auth, and the framework picker are deliberately not designed.
