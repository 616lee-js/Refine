# Alignment: this redesign ↔ `616lee-js/Refine@master`

Read after `README.md`, before writing code. Synced **2026-07-30**.

The design in this package was drawn before the codebase pivot landed. The pivot
has now landed, and the two agree on the hard parts. This file records what the
code already does, what is genuinely new, and the five places where design and
code conflict — those need a decision, not an implementation.

---

## Where the code already agrees with the design

**No AI in the writing surface.** `src/app/(protected)/journal-entry.tsx` is a
plain `<textarea>` with no reference to any model. Its header comment states the
theory directly: people learn by articulating without something shaping the
articulation as it happens. This *is* the design's central premise. Do not
reintroduce anything that reads the text while it's being written.

**The guidance rail.** `src/components/ui/journal-guidance-sidebar.tsx` is
already the design's `FootholdRail`:

- Fixed **20rem** column while the entry takes `1fr` — never an equal split.
- Collapsed removes the column entirely and returns the width to the writing.
- Below `lg` it leaves the flow and becomes an overlay — the design's mobile peeking sheet is the same idea, different presentation.
- **Open by default** ("guidance nobody can find does not exist"), overridden by the stored preference at `users.preferences.guidanceOpen`, `PATCH /api/user/preferences`, fire-and-forget.
- It takes **no entry text and no textarea ref** — by construction, not convention. Keep that property.

**Safety, and where it surfaces.** This resolves the gap flagged before the sync.
`src/lib/safety/classify-and-log.ts` + `chunk.ts` + `classifier.ts` run **only
when an entry is marked done**, and again on re-save after an edit — never during
writing. Output is invisible unless Tier 2/3, in which case
`CrisisResourcePanel` renders inline below the entry. The design has no equivalent
element; add one, styled in Dawn, appearing in exactly that position and on
exactly that trigger. `journal_entries.tier_classification` and `safety_log` hold
the record; the user never sees a tier.

**Saving.** Debounced autosave at **1500ms** after a pause (`PUT`), plus a
`navigator.sendBeacon` flush on `beforeunload`. Completion is a separate `PATCH`
that returns `{ tier, completedAt }`. The design's quiet "Saved 9:14" maps to the
existing `aria-live="polite"` states: `Saving…` / `Draft saved` / `Saved` / an
error line that reassures the text is still there. Keep the error copy's tone.

**Questionnaires are already modelled.** `questionnaire_responses` in
`src/lib/db/schema.ts`: `questionnaire_slug` + `questionnaire_version`, encrypted
answers and encrypted scoring `{ total, band, subscales? }`, nullable
`completed_at` for partials — which is what the design's "Finish later" needs.
Definitions are intended to live one-file-per-instrument in
`src/lib/questionnaires/` (**this directory does not exist yet — you are creating
it**). The design's "store raw item responses, not just totals" is already the
schema's intent.

**Trackers are questionnaires.** The schema names `daily_checkin` as a slug
alongside `gad7`. So `ScreenCheckin` is not a separate data shape — it's an
instrument with a different renderer. That also partly settles the open placement
question: Home's stub calls check-in a separate workflow with its own entry point.

**Mirror's confirm model.** `user_memory` uses `last_confirmed_at NULL` +
`is_active true` to mean *proposed*, and only confirmed rows become context. That
is exactly the design's Keep / Drop. User-initiated deletion removes the row
outright — so "Drop" is a hard delete, not a flag, and the design's "dropped items
are never re-proposed" needs enforcing in extraction, not in the UI.

**Memory kinds** are `fact | thread | preference | diagnostic_context | other`.
The design's Facts and Threads tabs map straight onto `fact` and `thread`.

---

## Net-new UI (nothing upstream to restyle)

- `ScreenFramework` — GAD-7 on one page. Also create `src/lib/questionnaires/gad7.ts`.
- `ScreenCheckin` — `daily_checkin` instrument + its renderer. Home's stub is a disabled "Coming soon" button; it becomes the real entry point.
- **Mirror Trends tab** — `ChartCard`, `LineChart`, `DotMatrix`, the "Plainly" prose reading. Note: scoring is encrypted per row, so trends are computed in application code over decrypted rows, never aggregated in SQL. Fine at this volume.
- The **norm line**. Nothing upstream carries it. It's compatible with the existing guidance item "Short is still worth writing" — but the norm line belongs *under the entry*, in the sheet, where it does its work.
- `Sheet`, `PageBg`, the whole Dawn token layer, `MicPill` / `DictationDisc` / `Waveform`, `ScaleRow`, `StepScale`, `HabitToggles`, `Chip`, `Eyebrow`.

`src/components/ui/` holds only `badge`, `crisis-resource-panel`,
`journal-guidance-sidebar`, `section-label`, `toast` — so no name collisions with
the design's vocabulary.

---

## Conflicts — decide before building

### 1. Vocabulary: Reflections, not Entries

The repo is deliberate about this. From `schema.ts`: a **journal entry** is the
data noun and has exactly one meaning; **reflection** is the product word for the
practice and stays the user-facing term in UI and routes. Routes are `/reflection/[id]`
(writing) and `/reflections/[id]` (reading), nav reads **Reflections · Mirror · Profile**.

The design says "Entries" in the nav, "148 entries", "Everything you've set down".

**Follow the repo.** Rename in implementation: nav "Reflections", the archive
headline becomes "Everything you've written", counts read "148 reflections". Keep
"entry" only where it refers to the thing on the page in body copy.

Also: the design's finish button is **"Set it down"**; the code says **"Done"** /
"Save changes" once completed. "Set it down" is the better line and carries the
anti-essay intent — but the code's two-state behaviour (an entry stays editable
after completion, and re-saving re-runs classification) must survive. Suggest
"Set it down" → "Save changes" on an already-completed entry.

### 2. Foothold framing vs. practice guidance — the real one

`src/lib/journal/guidance.ts` is written against an explicit constraint: guidance
is **about the practice, not the person**, makes no claims about the user, and
**never asks for a reply**. Three sections — "If you're not sure where to start",
"While you're writing", "Over time" — eight items, each a short heading plus one
or two sentences. All `source: "generic"`. The type already anticipates
`source: "personal"` for trend-based items, marked **v1.5+, once Cabinet 2 has
data**, and those will be *fetched*, never derived from what is currently being
typed.

The design's footholds are different in kind: **questions**, two of the three
drawn from previous entries and threads, each with a "Start here" action that
seeds the entry.

These are not the same feature. Three ways forward:

- **(a) Ship the repo's model now, design's later.** Restyle the existing eight practice-guidance items in Dawn for v1; hold the question-shaped footholds for v1.5 when `source: "personal"` lands. Lowest risk, and honours the "never asks for a reply" rule.
- **(b) Both, visibly separated.** Practice guidance as now, plus a distinct group at the top for personal footholds once available. The design's per-item source eyebrows ("Open prompt" / "From Sun 26 Jul" / "Thread · Sleep") already do this labelling work.
- **(c) Adopt the design wholesale** and relax the no-reply rule.

**Recommend (b), built as (a) first** — the rail's visual design is identical
either way, so this decision doesn't block the styling work. But it does change
the copy shipped in v1, so decide before writing the rail's content.

### 3. Entry titles don't exist

The design's complete screen shows an AI-generated title (*"On not wanting the
promotion"*, with "Rename it if that's wrong"), and the archive lists titles with
excerpts. Upstream: entries have **no title column**, and the archive lists dates
and times only. `journal_entry_summaries` (Cabinet 2) does hold a summary and
notable quotes — but the schema says it is **not surfaced to the user in v1**.

So the design's most legible archive feature is out of v1 scope as written.
Options: add a user-editable `title` column and let the user name it (no AI); or
ship the archive on dates plus a first-line excerpt derived at render time; or
bring Cabinet 2 forward. **Decide before building `ScreenList` and
`ScreenComplete`** — both depend on it.

Note also: an excerpt requires decrypting the body, and every deliberate
decryption is meant to write a `content_access_log` row. A list of 148 excerpts is
148 decryptions per page view. Worth a deliberate decision rather than a default.

### 4. Voice is designed but flag-gated

`entry_modality` keeps `voice` and `mixed` "for when dictation returns — see
src/lib/flags.ts", and `src/lib/transcription/web-speech.ts` plus
`src/types/speech.d.ts` are still in the tree, but nothing in the current surface
invokes them. The design treats voice as first-class input (`MicPill` on every
entry screen, `DictationDisc`, the dictating state, the mobile bottom bar).

Build the components and the dictating state, but **gate the UI behind the
existing flag** and let the design work at both settings — the entry screen must
look complete with no mic pill at all.

### 5. Trash is built and undesigned

`src/app/(protected)/trash/` + `trash-list.tsx`, `api/reflections/[id]/restore`,
`.../purge`, and `api/cron/purge-trash` implement a 30-day restorable trash;
purge nulls the body but keeps the row so `safety_log` survives. The design has
only a "Delete" affordance on read-back and no trash surface at all. Either ask
for a trash screen or style the existing one minimally in Dawn.

Related: the design's read-back "Delete" should match the code's actual
two-step — the entry screen asks "Move to trash?" inline with a confirm, not a
modal. Keep that pattern.

---

## Tokens: `globals.css` needs replacing, not extending

`src/app/globals.css` uses Tailwind v4 `@theme` with a full **stone-based**
semantic layer — `--color-surface`, `--color-text-primary`, `--color-action`, and
so on, with a comment instructing never to use raw `stone-*` utilities for
semantic purposes. Good discipline, wrong palette: the entire UI is currently
stone/white, and the design is warm paper (Dawn).

Recommended approach: **keep the semantic role names, repoint the values at
Dawn**, and add the tokens Dawn needs that have no equivalent (`--rf-paper`,
`--rf-paper-edge`, `--rf-rule`, `--rf-accent`, `--rf-accent-2`, the gradient, the
grain opacity). That way every existing `text-text-secondary` style keeps working
while the whole app changes palette in one file. Map, roughly:

| Existing | Dawn |
|---|---|
| `--color-surface` | `--rf-paper` `#fffdf7` |
| `--color-surface-subtle` | `--rf-surface` `#fbf7ef` |
| `--color-border-subtle` | `--rf-rule` |
| `--color-border-input` | `--rf-border` |
| `--color-border-hover` | `--rf-border-strong` |
| `--color-text-primary` | `--rf-text` `#1e1a14` |
| `--color-text-body` | `--rf-text` (entry body is primary, not secondary) |
| `--color-text-label` / `-secondary` | `--rf-text-2` / `--rf-text-3` |
| `--color-text-muted` | `--rf-text-4` |
| `--color-action` / `-hover` | `--rf-text` / lightened |
| `--color-ring-standard` | `--rf-accent` |

Two blocks to handle specially:

- **`--color-source-claude-*` (blue) is dead** — nothing in the product is authored by Claude any more. Remove it.
- **`--color-tier-*` badges** are used by `admin/safety-log`, which is an internal review tool, not product surface. Leave them alone; don't Dawn-ify the admin view.

Also note the app is currently **light-only**. Dawn ships full light + dark ramps;
confirm whether dark mode is in scope for this pass.

Type: nothing upstream loads a font — the app is on the default sans stack. The
design's Newsreader / Geist / Geist Mono is a net addition in `layout.tsx`.
`--leading-message: 1.8` was for assistant prose and is now unused.
