import type { Questionnaire } from "./types";
import { gad7 } from "./gad7";
import { phq9 } from "./phq9";

export * from "./types";

/**
 * The instrument registry.
 *
 * Every instrument the codebase knows about, shipped or not. Adding one is a new
 * file plus a line here — no migration, no seeding.
 */
const ALL: Questionnaire[] = [gad7, phq9];

const BY_SLUG = new Map(ALL.map((q) => [q.slug, q]));

/**
 * Looks up an instrument regardless of whether it ships. Use for reading back
 * historical responses — a response to an instrument that has since been
 * withdrawn must still render.
 */
export function getQuestionnaire(slug: string): Questionnaire | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Looks up an instrument the user is allowed to start.
 *
 * The `shipped` gate is enforced here rather than at each call site, so a route
 * cannot accidentally serve a gated instrument by forgetting to check. PHQ-9 is
 * gated until its item 9 response path is defined — see phq9.ts.
 */
export function getStartableQuestionnaire(slug: string): Questionnaire | null {
  const q = BY_SLUG.get(slug);
  return q && q.shipped ? q : null;
}

/** Instruments offered on Home and in the picker. */
export function listStartable(): Questionnaire[] {
  return ALL.filter((q) => q.shipped);
}
