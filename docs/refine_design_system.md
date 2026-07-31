# Refine — Design System

This document describes the design system as it exists in the codebase. It is descriptive, not aspirational. When an existing pattern feels wrong, it is flagged as an open question rather than silently changed. The system grows with the product — when a new pattern is needed, propose adding it here before building.

**Standing instruction:** When building new UI, consult this document. If a component or pattern is needed that isn't covered, propose an addition before building it.

---

## Implementation locations

| Artifact | Location | Role |
|---|---|---|
| Semantic token definitions | `src/app/globals.css` → `@theme {}` | CSS custom properties; single source of truth for color values |
| Shared UI components | `src/components/ui/` | Reusable React components; use these before writing ad-hoc |
| This document | `docs/refine_design_system.md` | Describes the system; references the implementation |

---

## Tokens

### Color

Refine uses the Tailwind `stone` neutral palette almost exclusively, supplemented by semantic status colors. Tokens are named by role, not by shade, so the intention is clear at the usage site.

All tokens are defined in `src/app/globals.css` under `@theme`. Use the semantic names in new components where possible.

#### Surface

| Token | Value | Usage |
|---|---|---|
| `--color-surface` | `#ffffff` | Primary page and card surface |
| `--color-surface-subtle` | `#fafaf9` (stone-50) | Inputs, code blocks, secondary card backgrounds |

#### Border

| Token | Value | Usage |
|---|---|---|
| `--color-border-subtle` | `#f5f5f4` (stone-100) | Page dividers, section separators, table row dividers |
| `--color-border-input` | `#e7e5e4` (stone-200) | Input borders, card borders, standard interactive borders |
| `--color-border-hover` | `#d6d3d1` (stone-300) | Hover state on bordered elements |

#### Text

| Token | Value | Usage |
|---|---|---|
| `--color-text-primary` | `#292524` (stone-800) | Page-level body text, headings |
| `--color-text-body` | `#44403c` (stone-700) | Message content, entry text, readable prose |
| `--color-text-label` | `#57534e` (stone-600) | Form labels, moderate secondary text |
| `--color-text-secondary` | `#78716c` (stone-500) | Timestamps, metadata, subdued labels |
| `--color-text-muted` | `#a8a29e` (stone-400) | Placeholder text, wordmark, faint UI chrome |

#### Interactive — actions

| Token | Value | Usage |
|---|---|---|
| `--color-action` | `#292524` (stone-800) | Primary button background |
| `--color-action-hover` | `#44403c` (stone-700) | Primary button hover |
| `--color-ring-standard` | `#a8a29e` (stone-400) | Default focus ring |
| `--color-ring-light` | `#d6d3d1` (stone-300) | Softer focus ring (textarea) |

#### Semantic status

| Token | Value | Usage |
|---|---|---|
| `--color-status-active-bg/text` | green-50 / green-600 | Active session badge |
| `--color-status-ended-bg/text` | stone-100 / stone-400 | Ended session badge |
| `--color-error` | `#dc2626` (red-600) | Error messages; WCAG AA on white ✓ |

#### Tier classification

| Tier | Background | Text | Tailwind classes |
|---|---|---|---|
| 0 | stone-100 | stone-500 | `bg-stone-100 text-stone-500` |
| 1 | yellow-100 | yellow-700 | `bg-yellow-100 text-yellow-700` |
| 2 | orange-100 | orange-700 | `bg-orange-100 text-orange-700` |
| 3 | red-100 | red-700 | `bg-red-100 text-red-700` |

Use `<Badge variant="tier-N" />` from `src/components/ui/badge.tsx` rather than raw classes.

#### Entry source badges

| Source | Background | Text |
|---|---|---|
| Claude | blue-50 | blue-500 |
| User | stone-100 | stone-500 |

---

### Typography

Refine uses a compressed type scale — almost everything is `text-xs` or `text-sm`. No `text-base` is used anywhere in the protected app; `text-2xl` appears only on auth pages.

| Usage | Classes |
|---|---|
| Page wordmark | `text-xs font-semibold tracking-widest uppercase text-stone-400` |
| Auth page title | `text-2xl font-semibold tracking-tight` |
| Section label | `text-xs font-semibold uppercase tracking-widest text-stone-400` |
| Body / form text | `text-sm text-stone-800` |
| Message content (Claude) | `text-sm text-stone-700 leading-[1.8] whitespace-pre-wrap` |
| User message bubble | `text-sm text-stone-800 leading-relaxed` |
| Metadata / timestamps | `text-xs text-stone-400` or `text-xs text-stone-500` |
| Error text | `text-xs text-red-600` (inline) or `text-sm text-red-600 role="alert"` (form-level) |
| Monospace (IDs, UUIDs) | `font-mono text-xs` |

**Custom line height:** `leading-[1.8]` is used for Claude's assistant messages. This value is defined as `--leading-message: 1.8` in `@theme`. It sits between Tailwind's `leading-relaxed` (1.625) and `leading-loose` (2.0) — chosen during testing as the best prose rhythm for reflective AI responses. See open question OQ-003.

---

### Spacing

**Page-level padding** — consistent across all pages:
- Header: `px-6 py-4`
- Main content: `px-6 py-8`
- Chat message area: `px-6 py-10` (additional breathing room)
- Chat footer: `px-6 py-5`

**Content max-widths:**
- `max-w-sm` — auth forms
- `max-w-md` — session selector cards, check-in form
- `max-w-2xl` — standard content (chat, sessions list, session detail)
- `max-w-prose` — Claude's message text within the 2xl container
- `max-w-5xl` — admin safety log table (needs width for columns)

**Component internal padding:**
- Large input/textarea: `px-4 py-3`
- Standard button: `px-4 py-2.5` or `px-5 py-2.5`
- Auth input/button: `px-3 py-2` (see open question OQ-001)
- Badge: `px-1.5 py-0.5`
- Small badge: `px-2 py-0.5`

---

### Responsive breakpoints — PROPOSED 2026-07-29

The system had no responsive conventions until the guidance sidebar needed one.
This records the first, so the next multi-column surface does not invent its own.

Tailwind defaults, only two of which the app uses:

| Breakpoint | Min width | What changes |
|---|---|---|
| `lg` | 1024px | **The only layout breakpoint.** Side-by-side becomes single-column below it |
| `sm` | 640px | Reserved for typography and spacing tweaks; no layout change |

Rules:

- **Single-column is the base case, not the fallback.** Write the narrow layout
  first and add `lg:` for the wide one. A phone should never receive markup
  designed for a desktop and then have it undone.
- **One breakpoint per surface.** If a layout needs three, it is doing too much.
- **Never hide content at a breakpoint** — move it. Anything that disappears
  below `lg` must remain reachable by a toggle, and anything genuinely optional
  should be optional at every width.

---

### Border radius

| Scale | Class | Usage |
|---|---|---|
| Badge / pill | `rounded` | Tier badges, status badges, source labels |
| Row hover | `rounded-lg` | List item hover region (sessions list) |
| Auth inputs/buttons | `rounded-md` | Login/signup form controls — see OQ-001 |
| Primary (app) | `rounded-xl` | All inputs, buttons, cards in the protected app |
| Chat bubble | `rounded-2xl rounded-br-sm` | User message bubble (asymmetric; intentional) |

---

## Component patterns

### Page header

Used verbatim across all protected pages and admin. No component has been extracted yet — the nav items vary enough per page that a component would need too many props for the current scale. Document the pattern; extract if it gains more pages.

```html
<header class="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
  <h1 class="text-xs font-semibold tracking-widest text-stone-400 uppercase">
    Refine [— Page Name]
  </h1>
  <!-- nav / actions right-aligned -->
</header>
```

Nav links use: `text-xs text-stone-400 hover:text-stone-600 transition-colors`

---

### Badge

**Component:** `src/components/ui/badge.tsx`

```tsx
import { Badge, tierVariant } from "@/components/ui/badge";

<Badge variant="status-active">Active</Badge>
<Badge variant={tierVariant(2)}>T2</Badge>
<Badge variant="source-claude">Claude</Badge>
```

Variants: `tier-0` `tier-1` `tier-2` `tier-3` `status-active` `status-ended` `source-claude` `source-user` `neutral`

Helper `tierVariant(n: number)` maps a tier integer to the correct variant.

---

### Section label

**Component:** `src/components/ui/section-label.tsx`

Used for named subsections within a page (check-in, entries, etc.).

```tsx
import { SectionLabel } from "@/components/ui/section-label";

<SectionLabel className="mb-3">Check-in</SectionLabel>
```

Renders an `<h2>` — use within semantic document structure.

---

### Button — primary

```html
<button class="
  px-4 py-2.5 rounded-xl
  bg-stone-800 text-white text-sm font-medium
  hover:bg-stone-700
  focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2
  disabled:opacity-40 disabled:cursor-not-allowed
  transition-colors
">
  Label
</button>
```

All primary buttons in the protected app should use `rounded-xl` and `focus:ring-offset-2`. See OQ-001 for the auth page deviation.

---

### Button — secondary / ghost

```html
<button class="
  px-4 py-2 rounded-xl
  border border-stone-200 text-stone-600 text-sm
  hover:bg-stone-50
  disabled:opacity-40 disabled:cursor-not-allowed
  transition-colors
">
  Label
</button>
```

---

### Button — text link

```html
<button class="text-xs text-stone-400 hover:text-stone-600 transition-colors">
  Label
</button>
```

Used for low-emphasis actions (End session, Sign out, nav links).

---

### Input / Textarea

```html
<!-- Textarea (app) -->
<textarea class="
  w-full resize-none rounded-xl
  border border-stone-200 bg-stone-50
  px-4 py-3 text-sm text-stone-800 placeholder-stone-400
  focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white
  leading-relaxed transition-colors
" />

<!-- Input (auth pages) — see OQ-001 -->
<input class="
  w-full rounded-md
  border border-stone-200 bg-stone-50
  px-3 py-2 text-sm placeholder:text-stone-400
  focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white
  transition-colors
" />
```

---

### Content block

Reusable prose container for displaying stored text (entries, check-in text, message content in debug views).

```html
<p class="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap bg-stone-50 rounded-xl px-4 py-3">
  {content}
</p>
```

---

### Empty state

```html
<p class="text-sm text-stone-400">No [items] yet.</p>
```

In chat (centered, with top breathing room):
```html
<div class="pt-24 text-center">
  <p class="text-sm text-stone-400 leading-loose">[Two-line message]</p>
</div>
```

---

### Crisis line — REMOVED 2026-07-29

There is no persistent crisis-line footer. The pattern existed briefly and was
removed as a deliberate Tier 0 design decision.

**Rationale:** Refine is an AI-augmented reflective journaling tool, not a
crisis-centric mental health app. An always-present crisis affordance framed every
screen — home, Mirror, history, settings — around crisis, which contradicts the
product's positioning. Normal reflection should carry no ambient crisis framing.

**Replaced by:** the tier-conditional crisis resource panel below, which surfaces
resources when a Tier 2/3 signal is actually detected. That is now the app's only
resource surface. See LIM-016 for what that concentration implies.

Do not reintroduce an ambient crisis affordance without revisiting that decision.

---

### Crisis resource panel (tier-conditional)

Implemented as `src/components/ui/crisis-resource-panel.tsx`. Content and the
tier-to-content mapping live in `src/lib/safety/crisis-resources.ts`, transcribed
from the Layer 3 `crisis-resources.md` fragment.

**This is the app's only crisis-resource surface.** It appears alongside a Claude
response generated at Tier 2 or Tier 3, and only after that response has finished
streaming — resources should not arrive before the user has been met. It renders
on both normal responses (`/api/chat`) and reflection-closing messages
(`/api/reflections/[id]/end`); both send the tier as an `X-Tier` response header.

Tier 0 and Tier 1 render nothing. Tier 1 explicitly does not pivot to resources.

| Tier | Heading posture | Contents |
|---|---|---|
| 2 | Available, not required | Lower-threshold options lead — SAMHSA, warmlines, sliding-scale directories — with 988 and Crisis Text Line following rather than heading the list. Present, but not the headline. |
| 3 | Direct, still present | Expanded and acute-first: 988 and Crisis Text Line lead, followed by the full support and directory set. Nothing is withheld — the panel must not read as the app narrowing to a handoff. |

```html
<aside aria-label="Support resources"
       class="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
  <p class="text-sm font-medium text-stone-700">[heading]</p>
  <p class="mt-1 text-xs text-stone-500 leading-relaxed">[framing]</p>
  <ul class="mt-4 space-y-4"><!-- resource items --></ul>
</aside>
```

**Posture rules — these are not stylistic preferences.**

- Inline in the message list, directly after the response it belongs to. Never a
  modal, never an interstitial, never dismissible-before-continuing. The user can
  keep typing with the panel on screen.
- `aria-label`, not `role="alert"`. An alert interrupts the screen reader
  mid-response; this is a region the user reaches when ready.
- Same stone palette as the rest of the app. No red, no warning iconography, no
  urgency styling. The content carries the weight; the chrome stays quiet.
- Links open in a new tab (`rel="noopener noreferrer"`) so the user never loses
  their reflection to navigate to a resource.

Content is pending clinical review — see LIM-015. Changes to which resources
appear, at which tier, or to the framing copy are safety changes, not design
iteration.

```html
<p class="mt-4 text-xs text-stone-400 text-center leading-relaxed">
  In crisis?
  <strong class="font-medium text-stone-500">Call or text 988</strong>
  ·
  <strong class="font-medium text-stone-500">Text HOME to 741741</strong>
</p>
```

---

### Guidance sidebar — PROPOSED 2026-07-29

Implemented as `src/components/ui/journal-guidance-sidebar.tsx`. Optional
supporting content beside the journal writing surface.

**The constraint that shapes everything else: the entry always holds width
priority.** The sidebar is a fixed `20rem` column; the entry takes `1fr`. It is
never a half-and-half split, and collapsing returns the full width to the entry.
The writing is the point; the guidance is a margin note.

```html
<!-- lg and up: two columns, entry takes remaining space -->
<div class="lg:grid lg:grid-cols-[1fr_20rem]">
  <main><!-- entry --></main>
  <aside class="hidden lg:block border-l border-stone-100"><!-- guidance --></aside>
</div>
```

**Behaviour:**

- **Expanded by default**, state persisted per user in `users.preferences`.
  Guidance nobody can find is guidance that does not exist.
- **Below `lg`** the sidebar leaves the flow entirely and becomes an overlay
  panel opened by a toggle in the header. The entry is alone on screen by
  default — on a phone, a writing surface sharing space with anything else is not
  a writing surface.
- The toggle is always present at every width. Collapsing is not a desktop-only
  affordance.

**Hard rule — it never reads the entry.** The sidebar receives no props carrying
the body text, and no handler in it observes the textarea. It is beside the
writing, not about it. Content is generic today; when personal or trend-based
prompts arrive they come from stored data, still never from the live text.

---

### Toast — PROPOSED 2026-07-29

Transient confirmation of an action that already succeeded. Bottom-centre,
auto-dismissing.

```html
<div role="status" aria-live="polite"
     class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
            rounded-xl bg-stone-800 text-white text-sm px-4 py-2.5 shadow-lg">
  Moved to trash
</div>
```

**Use for:** save confirmed, moved to trash, restored, permanently deleted.

**Do not use for:** anything the user must read or act on. A toast that carries
information available nowhere else is a bug — it disappears, and it disappears
fastest for the people least able to read it quickly.

- `role="status"` with `aria-live="polite"`, never `alert` — these confirm, they
  do not interrupt.
- ~4 seconds, and never the only feedback: the underlying view should already
  reflect the change.
- One at a time. A queue of toasts means too much is being confirmed.
- Distinct from **inline confirmation** (`Remove? / Cancel` in place), which is
  the existing pattern for asking *before* a destructive action. Toasts report
  after; inline confirms before.

---

## Responsive conventions

Added 2026-07-30, during the Step 7 responsive pass. Before this the document
had no breakpoint conventions at all, and each screen invented its own.

### Breakpoints

Tailwind defaults, only three of which are used:

| Prefix | Min width | What it means here |
|---|---|---|
| (none) | 0 | **Phone.** Single column, everything stacked. This is the base case, not the fallback. |
| `sm:` | 640px | Large phone / small tablet. Row layouts that need two columns of their own (a label beside its control). |
| `lg:` | 1024px | **Laptop.** Anything with a genuine sidebar or a second reading column. |

`md:` and `xl:` are deliberately unused. Two decision points are enough for a
product with this few layouts, and every extra breakpoint is another state to
verify on every screen.

### Rules

1. **The page body never scrolls horizontally.** Anything intrinsically wide —
   a table, a `<pre>`, a chart — scrolls inside its own `overflow-x-auto`
   container. See `settings/system-prompt` and `admin/safety-log`.
2. **Multi-column grids always carry a breakpoint prefix.** A bare
   `grid-cols-2` is a bug: it forces two columns onto a 375px screen. Write
   `sm:grid-cols-2` or `lg:grid-cols-2` and let the base case stack.
3. **The writing surface keeps width priority.** The guidance sidebar is a fixed
   column at `lg:` and an overlay below it — it never squeezes the entry. This
   is the one rule that outranks visual consistency.
4. **Charts scale, they do not fix.** `LineChart` draws into a fixed `viewBox`
   and takes `width="100%"`, so it scales rather than clipping. Never give a
   chart a pixel width.
5. **Row layouts stack rather than shrink.** A label/control pair collapses to
   two stacked rows below its breakpoint. Squeezing a 260px control column into
   120px produces tap targets nobody can hit.
6. **When a shared column header is hidden, its labels move into each row.**
   The framework questionnaire hides its response-option header below `sm:` and
   repeats the labels under each radio, so the answer scale is never unlabelled.
7. **Type does not shrink at breakpoints.** `--text-entry` is 18.5px on a phone
   and 18.5px on a laptop. Where a heading must adapt, use `clamp()` rather than
   a breakpoint — see onboarding's `clamp(27px, 4.4vw, 40px)`.
8. **Nav wraps, it does not truncate.** `TopNav` is `flex-wrap` with
   `justify-end`; a second line is correct behaviour, a hidden link is not.

### Verification

Check every new screen at **375**, **768**, and **1440**. The failure that keeps
recurring is a fixed-width grid column, so look for a horizontal scrollbar on
the body first — it is the fastest tell.

---

## Interaction patterns

### Focus states

- **Inputs/textareas:** `focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white` — softer ring, background lift
- **Primary buttons:** `focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2` — prominent ring with offset
- **Text links / nav:** no explicit focus style currently — see OQ-004

All interactive elements must have a visible focus state for keyboard navigation. `focus:outline-none` is only acceptable when paired with a custom ring.

### Hover states

- Text links: `hover:text-stone-600` (from stone-400 base)
- Row items: `hover:bg-stone-50`
- Primary button: `hover:bg-stone-700`
- Bordered card: `hover:border-stone-300 hover:bg-stone-50`

### Disabled states

`disabled:opacity-40 disabled:cursor-not-allowed` — used consistently on all interactive controls. Applied whenever an action is temporarily unavailable (streaming, session ended).

### Transitions

`transition-colors` on all interactive elements. No `transition-all` (too broad). No motion-heavy animations except:
- Streaming cursor: `animate-pulse` on a `w-0.5 h-[1em]` span
- Voice listening indicator: `animate-pulse` on `w-2 h-2 rounded-full bg-red-400`

For users who prefer reduced motion, the pulsing animations should be suppressed. See OQ-005.

---

## Accessibility commitments

These are standing commitments, not aspirational goals. New UI should meet them from the start.

### Color contrast

- All text must meet WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt bold+)
- `text-stone-400` on `bg-white`: ~3.6:1 — **fails AA for normal text.** This value is used for placeholder text and decorative labels only — never for meaningful content. Placeholder and label text can use stone-400 because they are supplementary.
- `text-stone-500` on `bg-white`: ~5.9:1 ✓
- `text-stone-600` on `bg-white`: ~8.2:1 ✓
- `text-stone-800` on `bg-white`: ~16.1:1 ✓
- `text-red-600` on `bg-white`: ~5.8:1 ✓ — use this for error text, not red-500 (4.6:1, borderline)
- `text-white` on `bg-stone-800`: ~16.1:1 ✓

Before any new color combination is introduced, verify contrast at [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

### Semantic HTML

- All pages use `<header>`, `<main>`, `<footer>` landmarks
- Lists use `<ol>` / `<ul>` with `<li>` — not `<div>` stacks
- Form inputs are linked to labels (explicit `htmlFor` or `aria-label`). Screen-reader-only labels use `className="sr-only"`
- Error messages use `role="alert"` for form-level errors; inline field errors use `aria-describedby` when added
- Chat message list: `aria-live="polite" aria-atomic="false"` — streaming content is announced

### Focus management

- All interactive elements are keyboard-reachable
- Tab order follows visual order
- `focus:outline-none` only when a visible custom focus ring is present

### Motion sensitivity

- `animate-pulse` is used for the streaming cursor and voice indicator. Wrap in `@media (prefers-reduced-motion: reduce)` to suppress. Not yet implemented — see OQ-005.

### Voice mode accessibility — STALE 2026-07-29

Voice is archived (`archive/chat-model/`) and the journal surface has no voice
mode. Retained because the transcription provider survives in
`src/lib/transcription/` and dictation-into-a-textarea is a likely future
feature — but the specifics below describe the retired accumulate-and-send
paradigm, not anything currently in the app. Re-derive rather than reuse.

### Voice mode accessibility (retired paradigm)

- Voice mode has a visible status indicator (Listening / Restarting / Sending)
- Interim and buffered text are visible on screen (not just auditory)
- Manual "I'm done" button allows keyboard trigger without relying on the pause timer

---

## Open questions

These are inconsistencies or decisions that need deliberate resolution. Do not silently fix — discuss and update this document when resolved.

### OQ-001 — Auth page radius/size vs app conventions

Auth inputs and buttons use `rounded-md px-3 py-2`. The protected app uses `rounded-xl px-4 py-3` (textarea) and `rounded-xl px-4 py-2.5` (buttons). The auth pages feel slightly different from the rest of the app.

**Options:** (a) Intentional — auth is a distinct "outside the app" context and a more conservative radius fits; (b) Inconsistency — unify everything on `rounded-xl` for coherence.

**Lean:** Intentional split is defensible; many apps make auth feel distinct. But worth deciding explicitly.

### OQ-002 — Error text: red-500 (chat) vs red-600 (auth) — RESOLVED 2026-05-08

Standardized on `text-red-600` everywhere. `chat.tsx` voice error updated. Red-600 (5.8:1) meets WCAG AA on white; red-500 (4.6:1) is borderline.

### OQ-003 — leading-[1.8] for assistant messages

The custom `leading-[1.8]` value is used for Claude's prose responses. It's defined as `--leading-message: 1.8` in `@theme`. The Tailwind utilities `leading-relaxed` (1.625) and `leading-loose` (2.0) are the closest built-ins.

**Question:** Is 1.8 a deliberate calibrated choice worth keeping as a named token, or should it normalize to `leading-relaxed` or `leading-loose`?

**Lean:** Keep as named token (`leading-message`) — the choice was made during testing and the name makes intent clear.

### OQ-004 — Text link focus states

Nav links and text-link buttons (`text-xs text-stone-400 hover:text-stone-600`) have no explicit focus ring. They rely on the browser's default outline, which varies by browser and OS and often conflicts with `focus:outline-none`.

**Resolution pending:** Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-1 rounded` to text links. Use `focus-visible:` (not `focus:`) to avoid showing ring on mouse click.

### OQ-005 — Reduced motion: animate-pulse not suppressed — RESOLVED 2026-05-08

Added to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse { animation: none; }
}
```
Streaming cursor and voice indicator animations suppressed for users with `prefers-reduced-motion: reduce`.

---

*Last updated: 2026-05-08. Add new patterns as they are built; surface new inconsistencies as OQ-### entries.*
