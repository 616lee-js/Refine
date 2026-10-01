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
 * `source` distinguishes this generic guidance from items drawn from one person's
 * own record. Those **arrived 2026-10-01** and are built in ./personal-guidance.ts,
 * which runs on the server because it reads and decrypts. The sidebar renders both
 * kinds identically; only the origin and the provenance label differ.
 *
 * Personal items are fetched, never derived from what is being typed. Neither this
 * file nor that one has a parameter for the entry text, and the sidebar has no prop
 * for it. That is structural rather than conventional.
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

// COPY REVIEW: all of it. Every section title, item title and item body
// here is draft content written by Claude Code, already flagged for the
// product owner's content pass — see the header note above. The
// constraints it is written against (optional, about the practice not the
// person, never asks for a reply, no engagement mechanics) are product
// rules and survive any rewording.
const GENERIC_SECTIONS: GuidanceSection[] = [
  {
    /*
     * Ways to write one, as opposed to advice about writing.
     *
     * Added 2026-10-01 at the product owner's request: "a few different options
     * for recommendations how to write a reflection". Everything that already
     * existed here is guidance *about* the practice — permission, reassurance,
     * what not to worry about. None of it answers "what do I actually do with
     * this blank page", which is the thing someone sitting in front of one wants.
     *
     * These are shapes to pick from, not steps to follow, and none of them is the
     * recommended one. Each still obeys the constraints above: optional, about the
     * writing rather than the writer, and never expecting a reply.
     */
    id: "approaches",
    title: "[COPY] Ways to write one",
    items: [
      {
        id: "approach-one-moment",
        title: "[COPY] One moment, in detail",
        body: "[COPY] Pick a single thing that happened and write only that — who was there, what was said, what you noticed. Narrower than a day and usually more revealing.",
        source: "generic",
      },
      {
        id: "approach-unsent",
        title: "[COPY] The thing you won't say",
        body: "[COPY] Write it to the person it concerns, knowing you will never send it. Being unfair on the page is allowed, and it is often where the real objection surfaces.",
        source: "generic",
      },
      {
        id: "approach-loose-ends",
        title: "[COPY] What's still open",
        body: "[COPY] List what is unresolved, without solving any of it. Naming the open things is a complete entry — the list is the point, not what you do about it.",
        source: "generic",
      },
      {
        id: "approach-plain-account",
        title: "[COPY] Just what happened",
        body: "[COPY] A plain account with no interpretation at all. Useful on a day you cannot find a feeling about, and it usually turns out to contain one.",
        source: "generic",
      },
      {
        id: "approach-changed-mind",
        title: "[COPY] Something you've changed your mind about",
        body: "[COPY] What you thought before, what you think now, and when it shifted. The shift is often more informative than either position.",
        source: "generic",
      },
    ],
  },
  {
    id: "starting",
    title: "[COPY] If you're not sure where to start",
    items: [
      {
        id: "start-anywhere",
        title: "[COPY] Start in the middle",
        body: "[COPY] You don't need an opening line. Begin with whatever is nearest to the surface and let the rest arrive as you write.",
        source: "generic",
      },
      {
        id: "start-concrete",
        title: "[COPY] Start with something concrete",
        body: "[COPY] A specific moment from the day is often easier to write about than how you feel in general — and it usually gets there anyway.",
        source: "generic",
      },
      {
        id: "start-small",
        title: "[COPY] Short is still worth writing",
        body: "[COPY] Three sentences on a day you'd rather not think about is a real entry. Length isn't the measure of anything here.",
        source: "generic",
      },
    ],
  },
  {
    id: "while-writing",
    title: "[COPY] While you're writing",
    items: [
      {
        id: "no-audience",
        title: "[COPY] Nobody is reading this",
        body: "[COPY] No one sees your entries but you. You can contradict yourself, be unfair, change your mind halfway through, and leave it that way.",
        source: "generic",
      },
      {
        id: "unfinished",
        title: "[COPY] It doesn't have to resolve",
        body: "[COPY] Writing toward a neat conclusion tends to close things down early. It's fine to end mid-thought, or without knowing what you think.",
        source: "generic",
      },
      {
        id: "specifics",
        title: "[COPY] Specifics carry more than summaries",
        body: "[COPY] What was said, what you noticed, what time it was. Detail tends to reveal more on re-reading than a summary of how the day went.",
        source: "generic",
      },
    ],
  },
  {
    id: "over-time",
    title: "[COPY] Over time",
    items: [
      {
        id: "rereading",
        title: "[COPY] Re-reading is part of it",
        body: "[COPY] Entries from a few weeks ago often read differently than they felt to write. That gap is usually where the useful part is.",
        source: "generic",
      },
      {
        id: "irregular",
        title: "[COPY] Irregular is fine",
        body: "[COPY] A gap in your entries isn't a lapse to correct. People write when there's something to write about, and that isn't evenly distributed.",
        source: "generic",
      },
    ],
  },
];

/**
 * The practice guidance, identical for everyone.
 *
 * Takes no arguments and never will. Anything drawn from a particular person's
 * writing is built in ./personal-guidance.ts, which runs on the server because it
 * reads and decrypts — and which still never receives the entry text. The sidebar
 * does not respond to what is being written.
 */
export function genericSections(): GuidanceSection[] {
  return GENERIC_SECTIONS;
}

/** Total items across sections, for the collapsed spine's count. */
export function countItems(sections: GuidanceSection[]): number {
  return sections.reduce((n, s) => n + s.items.length, 0);
}
