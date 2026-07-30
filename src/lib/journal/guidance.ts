/**
 * Guidance shown beside the journal writing surface.
 *
 * ── Draft content, pending review ─────────────────────────────────────────────
 * Written by Claude Code and flagged for the product owner's content pass. It is
 * general reflective-journaling practice guidance, deliberately not clinical and
 * deliberately not instruction about what to feel, conclude, or do.
 *
 * ── Constraints this content is written against ───────────────────────────────
 * - It is **optional**. Nobody needs to read it to journal. It never implies the
 *   entry is being done wrong.
 * - It is **about the practice, not the person**. No claims about the user, no
 *   interpretation, nothing that assumes distress.
 * - It **never asks for a reply**. These are not prompts the app expects answers
 *   to; the entry is not a response to anything.
 * - It carries **no engagement mechanics** — no streaks, no "you haven't written
 *   in a while", nothing that manufactures obligation. This is a hard product
 *   rule, not a stylistic preference.
 *
 * ── Structure ─────────────────────────────────────────────────────────────────
 * `source` distinguishes generic guidance from the personal/trend-based prompts
 * that arrive later (v1.5+, once Cabinet 2 has data). The sidebar renders both
 * identically; only the origin differs. Personal items will be fetched, never
 * derived from what is currently being typed — the sidebar does not read the
 * entry.
 */

export type GuidanceSource = "generic" | "personal";

export type GuidanceItem = {
  id: string;
  /** Short heading. Sentence case, no trailing punctuation. */
  title: string;
  /** One or two sentences. Plain, unhurried, never imperative about feelings. */
  body: string;
  source: GuidanceSource;
  /**
   * Provenance eyebrow, rendered above the item — "From Sun 26 Jul",
   * "Thread · Sleep". Only meaningful for `source: "personal"`: generic practice
   * guidance has no provenance worth stating, and labelling every item "Generic"
   * would be noise.
   *
   * The rail already renders this when present, so personal footholds need no
   * component change when they arrive — only data.
   */
  sourceLabel?: string;
};

export type GuidanceSection = {
  id: string;
  /** Section heading, or null for an unheaded lead group. */
  title: string | null;
  items: GuidanceItem[];
};

const GENERIC_SECTIONS: GuidanceSection[] = [
  {
    id: "starting",
    title: "If you're not sure where to start",
    items: [
      {
        id: "start-anywhere",
        title: "Start in the middle",
        body: "You don't need an opening line. Begin with whatever is nearest to the surface and let the rest arrive as you write.",
        source: "generic",
      },
      {
        id: "start-concrete",
        title: "Start with something concrete",
        body: "A specific moment from the day is often easier to write about than how you feel in general — and it usually gets there anyway.",
        source: "generic",
      },
      {
        id: "start-small",
        title: "Short is still worth writing",
        body: "Three sentences on a day you'd rather not think about is a real entry. Length isn't the measure of anything here.",
        source: "generic",
      },
    ],
  },
  {
    id: "while-writing",
    title: "While you're writing",
    items: [
      {
        id: "no-audience",
        title: "Nobody is reading this",
        body: "No one sees your entries but you. You can contradict yourself, be unfair, change your mind halfway through, and leave it that way.",
        source: "generic",
      },
      {
        id: "unfinished",
        title: "It doesn't have to resolve",
        body: "Writing toward a neat conclusion tends to close things down early. It's fine to end mid-thought, or without knowing what you think.",
        source: "generic",
      },
      {
        id: "specifics",
        title: "Specifics carry more than summaries",
        body: "What was said, what you noticed, what time it was. Detail tends to reveal more on re-reading than a summary of how the day went.",
        source: "generic",
      },
    ],
  },
  {
    id: "over-time",
    title: "Over time",
    items: [
      {
        id: "rereading",
        title: "Re-reading is part of it",
        body: "Entries from a few weeks ago often read differently than they felt to write. That gap is usually where the useful part is.",
        source: "generic",
      },
      {
        id: "irregular",
        title: "Irregular is fine",
        body: "A gap in your entries isn't a lapse to correct. People write when there's something to write about, and that isn't evenly distributed.",
        source: "generic",
      },
    ],
  },
];

/**
 * Guidance for the sidebar.
 *
 * Takes no arguments today. When personal prompts arrive this becomes an async
 * lookup by user — but it will never take the entry text as a parameter, because
 * the sidebar does not respond to what is being written.
 */
export function getGuidanceSections(): GuidanceSection[] {
  return GENERIC_SECTIONS;
}
