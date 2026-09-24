/**
 * The fixed category vocabulary — the buckets an entry can be sorted into.
 *
 * ── Why fixed ─────────────────────────────────────────────────────────────────
 * Until 2026-09-24 the summariser was told to use the writer's own words, so
 * categories came back as one-off phrases: "the promotion", "Tuesday's
 * argument". A tag that applies to exactly one entry groups nothing — the
 * archive's category filter never narrowed anything, and everything built on
 * summaries downstream would inherit the same mess.
 *
 * A closed list can also be **enforced**, which an open one cannot. The
 * summariser is told to pick from here, and `parse.ts` discards anything that
 * is not on the list before it reaches storage — so the constraint is a
 * guarantee rather than an instruction the model might ignore.
 *
 * ── This is the only copy ─────────────────────────────────────────────────────
 * Three things consume it: the prompt (interpolated at call time, so the
 * markdown cannot fall out of step), the parser, and the editing UI. Each
 * holding its own copy is exactly how they would drift apart.
 *
 * ── Changing it is not free ───────────────────────────────────────────────────
 * Editing this list changes what every future summary can say. `generate.ts`
 * folds a fingerprint of it into `SUMMARISER_VERSION`, so a change here makes
 * every existing summary due for regeneration — which is correct, since they
 * would otherwise be two incompatible vintages with no way to tell them apart.
 *
 * Note what does NOT regenerate: a summary the user has corrected. Those live
 * in `encrypted_user_content`, which the queue never writes to, so a correction
 * keeps whatever categories it was given. That is deliberate — it is the user's
 * text — and it is why the filter may show terms that are not on this list.
 */

/**
 * The glosses are for the model, not the user. They exist so it applies the
 * edges consistently — "rest" and "health" would otherwise blur, as would
 * "purpose" and "personal growth".
 */
export const CATEGORIES = [
  { value: "work", gloss: "a job, study, career, or the absence of one" },
  {
    value: "relationships",
    gloss: "partners, family, friendships — a specific person or the state of a bond",
  },
  { value: "health", gloss: "the body and the mind: illness, treatment, how they feel physically" },
  { value: "money", gloss: "income, cost, security, or the worry about it" },
  {
    value: "purpose",
    gloss: "meaning, direction, what they are for — larger than any one job",
  },
  { value: "rest", gloss: "sleep, recovery, time off, or the lack of it" },
  {
    value: "community",
    gloss: "belonging beyond close relationships — neighbours, groups, place",
  },
  {
    value: "personal growth",
    gloss: "changing themselves on purpose: habits, learning, who they are becoming",
  },
  { value: "faith", gloss: "belief, practice, doubt, the spiritual" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

/** Just the terms, in order. What the prompt lists and the UI offers. */
export const CATEGORY_VALUES: readonly string[] = CATEGORIES.map((c) => c.value);

/** Lowercased term → canonical spelling, so "Work" and "work" do not split. */
const BY_LOWER = new Map(CATEGORIES.map((c) => [c.value.toLowerCase(), c.value]));

/**
 * Resolves one term to its canonical spelling, or null if it is not a known
 * category. Trims and lowercases first — the model is asked for exact spelling
 * but should not fail the whole set over a capital letter.
 */
export function canonicalCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return BY_LOWER.get(raw.trim().toLowerCase()) ?? null;
}

/** True when a term is one of the nine. */
export function isKnownCategory(raw: unknown): boolean {
  return canonicalCategory(raw) !== null;
}

/**
 * A short, stable fingerprint of the list, folded into the summariser version.
 *
 * Deliberately not a hash: readable in `generation_version` and in the logs, so
 * "which vocabulary produced this summary" is answerable by looking rather than
 * by re-deriving. First letters plus the count is enough to distinguish any
 * realistic edit.
 */
export const CATEGORY_FINGERPRINT = `c${CATEGORIES.length}-${CATEGORIES.map(
  (c) => c.value[0]
).join("")}`;

/** The block the summariser prompt interpolates. */
export function categoryPromptBlock(): string {
  return CATEGORIES.map((c) => `- \`${c.value}\` — ${c.gloss}`).join("\n");
}
