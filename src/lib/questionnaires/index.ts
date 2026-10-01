import type { Questionnaire } from "./types";
import { gad7 } from "./gad7";
import { phq9 } from "./phq9";
import { swls } from "./swls";
import { pwi } from "./pwi";
import { dailyCheckin } from "./daily-checkin";

export * from "./types";

/**
 * The instrument registry.
 *
 * Every instrument the codebase knows about, shipped or not. Adding one is a new
 * file plus a line here — no migration, no seeding.
 */
const ALL: Questionnaire[] = [gad7, phq9, swls, pwi, dailyCheckin];

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
 * cannot accidentally serve a withheld instrument by forgetting to check.
 *
 * This said "PHQ-9 is gated until its item 9 response path is defined". That
 * stopped being true on 2026-09-24, when PHQ-9 shipped with recording-without-
 * responding as the intended behaviour rather than a gap — see phq9.ts. What is
 * withheld today is SWLS, replaced by the Personal Wellbeing Index.
 */
export function getStartableQuestionnaire(slug: string): Questionnaire | null {
  const q = BY_SLUG.get(slug);
  return q && q.shipped ? q : null;
}

/** Instruments offered on Home and in the picker. */
export function listStartable(): Questionnaire[] {
  return ALL.filter((q) => q.shipped);
}

/**
 * How an instrument is named in a list: what it is for, then what it is called.
 *
 * "Generalised anxiety (GAD-7)". The product owner's instruction — a picker
 * showing only "GAD-7" asks you to already know what GAD-7 measures, and one
 * showing only "Generalised anxiety" hides which instrument you are about to
 * answer, which matters because these are published instruments with published
 * scoring.
 *
 * Built from the existing fields rather than duplicated into each file, so the two
 * halves cannot disagree. Deliberately **not** used in a record's own header,
 * which already prints the short name in its eyebrow above the full title — there
 * it would say the name twice.
 */
export function instrumentLabel(q: Questionnaire): string {
  return `${q.title} (${q.shortName})`;
}

/** The daily tracker, which Home surfaces separately from framework instruments. */
export { dailyCheckin };
