/**
 * Crisis resource data for the tier-conditional resource panel.
 *
 * ── Provenance ────────────────────────────────────────────────────────────────
 * Every entry here is transcribed from `src/lib/layer3/crisis-resources.md`,
 * which is the Layer 3 fragment given to Claude at Tier 2 and Tier 3. Nothing in
 * this file was curated, invented, or sourced elsewhere. The two must stay in
 * agreement: the Layer 3 protocols tell Claude "the rendered list is the source
 * of truth," which is only honest if this file mirrors that fragment.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The Tier 2 protocol instructs Claude not to list resources in detail because
 * the app renders them. Until this panel, the app did not — resources reached
 * Claude's context and never the user's screen. This closes that gap.
 *
 * ── PENDING CLINICAL REVIEW ───────────────────────────────────────────────────
 * This is a self-described starter list. Which resources appear, how they are
 * grouped, what is shown at which tier, and the framing copy are all subject to
 * the v2 clinical review gate. See LIM-015. Treat edits here as safety changes,
 * not content tweaks.
 */

export type ResourceCategory = "crisis" | "support" | "directory";

export type CrisisResource = {
  id: string;
  name: string;
  /** Primary action line — phone, text instruction, etc. Rendered prominently. */
  contact?: string;
  /** One-line plain description. Kept close to the source fragment's wording. */
  description: string;
  /** Bare domain; rendered as a link. */
  url?: string;
  category: ResourceCategory;
};

/** Immediate crisis lines. */
const CRISIS: CrisisResource[] = [
  {
    id: "988",
    name: "988 Suicide and Crisis Lifeline",
    contact: "Call or text 988",
    description:
      "Available 24/7, for people in emotional distress or suicidal crisis.",
    url: "988lifeline.org",
    category: "crisis",
  },
  {
    id: "crisis-text-line",
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    description: "Free, 24/7 crisis counseling via text.",
    category: "crisis",
  },
];

/** Lower-threshold support — not crisis lines. */
const SUPPORT: CrisisResource[] = [
  {
    id: "samhsa",
    name: "SAMHSA National Helpline",
    contact: "1-800-662-4357",
    description:
      "Free, confidential, 24/7. Substance use and mental health referrals.",
    url: "samhsa.gov/find-help/national-helpline",
    category: "support",
  },
  {
    id: "warmlines",
    name: "Warmlines",
    description:
      "Staffed by people with lived mental health experience. Lower threshold than crisis lines — for when you need to talk but aren't in crisis.",
    url: "warmline.org",
    category: "support",
  },
];

/** Sliding-scale therapy directories. */
const DIRECTORIES: CrisisResource[] = [
  {
    id: "open-path",
    name: "Open Path Collective",
    description: "Sessions $30–$80.",
    url: "openpathcollective.org",
    category: "directory",
  },
  {
    id: "inclusive-therapists",
    name: "Inclusive Therapists",
    description: "BIPOC and LGBTQ+ affirming focus.",
    url: "inclusivetherapists.com",
    category: "directory",
  },
  {
    id: "psychology-today",
    name: "Psychology Today",
    description: "Filter by sliding scale.",
    url: "psychologytoday.com/us/therapists",
    category: "directory",
  },
];

export type ResourcePanelContent = {
  /** Panel heading. Deliberately not alarm-shaped. */
  heading: string;
  /** One line under the heading framing these as available, not required. */
  framing: string;
  resources: CrisisResource[];
};

/**
 * Tier 2 — support-oriented, but complete.
 *
 * Leads with lower-threshold options (warmlines, sliding-scale, SAMHSA) because
 * that is the Tier 2 posture: available, not urgent. The crisis lines follow
 * rather than lead — present without being the headline.
 *
 * They are present at all deliberately. An earlier version omitted them here on
 * the reasoning that 988 and Crisis Text Line were permanently visible in a page
 * footer. That footer was removed on 2026-07-29 (see the design system doc), so
 * that reasoning no longer holds — omitting them now would mean a user at Tier 2
 * is shown no immediate crisis line anywhere in the app. The planning doc's Tier 2
 * description is explicit: "Resources include 988, Crisis Text Line, warmlines,
 * plus lower-threshold options."
 */
const TIER_2: ResourcePanelContent = {
  heading: "Some things that are here if you want them",
  framing: "No pressure to use any of these. They're here either way.",
  resources: [...SUPPORT, ...DIRECTORIES, ...CRISIS],
};

/**
 * Tier 3 — expanded, acute-focused.
 *
 * Crisis lines first and complete. Nothing is withheld: the support options and
 * directories still follow, so the panel does not read as the app narrowing to a
 * handoff. The continued-presence commitment means this appears as support, not
 * as a door closing.
 */
const TIER_3: ResourcePanelContent = {
  heading: "Please consider reaching out to one of these",
  framing:
    "This is bigger than what this app can hold. These are staffed by people who can help right now.",
  resources: [...CRISIS, ...SUPPORT, ...DIRECTORIES],
};

/**
 * Returns panel content for a tier, or null when no panel should render.
 * Tiers 0 and 1 render nothing — Tier 0 is baseline, and Tier 1 explicitly does
 * not pivot to resources.
 */
export function resourcePanelFor(tier: number): ResourcePanelContent | null {
  if (tier === 2) return TIER_2;
  if (tier === 3) return TIER_3;
  return null;
}
