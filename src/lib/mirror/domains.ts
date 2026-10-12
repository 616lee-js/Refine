/**
 * The life areas a report breaks out into.
 *
 * ── Where these come from ─────────────────────────────────────────────────────
 * The seven core domains of the Personal Wellbeing Index, chosen by the product
 * owner so a report's "Health" section and a Health score speak the same
 * language. The `key`s are deliberately the same as `pwi.ts`'s item keys: joining
 * a section to the score for the same domain should need no mapping table.
 *
 * ── The overall account is not one of these ───────────────────────────────────
 * A report opens with an account of what the person is actually writing about,
 * and only then breaks out by area. That lead section is not a domain and is not
 * in this list — it is where everything these seven cannot hold belongs.
 *
 * That matters, because the seven do not cover a journal. Of the nine categories
 * the summariser already attaches to entries, **faith** has no domain here at all
 * (the PWI's spiritual domain is optional and deliberately excluded), **rest**
 * only folds awkwardly into health, and **work**, **purpose** and **personal
 * growth** all collapse onto "achieving in life". Grief, identity and creative
 * work have no home either. Without a lead section, a report organised by these
 * would quietly drop all of it.
 *
 * ── Changing this list is not free ────────────────────────────────────────────
 * It is interpolated into the prompt at call time, so the markdown cannot drift
 * from it, and a fingerprint is folded into the stored report version — so a
 * change here is visible in the record rather than silent. Same arrangement as
 * the summariser's categories, for the same reason.
 *
 * ── Keys are frozen once a report exists ──────────────────────────────────────
 * A stored report holds section keys. Renaming one does not error; it makes the
 * section unrenderable and the join to a PWI score impossible. Labels and glosses
 * are free to change.
 */

export const REPORT_DOMAINS = [
  {
    key: "standard_of_living",
    label: "Standard of living",
    gloss: "money, what it affords, and the worry about it",
  },
  {
    key: "health",
    label: "Health",
    gloss: "the body and the mind — illness, treatment, sleep, how they feel physically",
  },
  {
    key: "achieving",
    label: "Achieving in life",
    gloss:
      "work, study, direction, and what they are trying to become. Wider than a job",
  },
  {
    key: "relationships",
    label: "Relationships",
    gloss: "partners, family, friendships — a specific person or the state of a bond",
  },
  {
    key: "safety",
    label: "Safety",
    gloss: "feeling safe, or not — physically, or in a situation they are in",
  },
  {
    key: "community",
    label: "Community",
    gloss: "belonging beyond close relationships — neighbours, groups, place, institutions",
  },
  {
    key: "future_security",
    label: "Future security",
    gloss: "what is ahead and how settled it feels. Not only financial",
  },
] as const;

export type DomainKey = (typeof REPORT_DOMAINS)[number]["key"];

const BY_KEY = new Map(REPORT_DOMAINS.map((d) => [d.key, d]));

/** The label for a stored section key, or null when the key is not one of ours. */
export function domainLabel(key: string): string | null {
  return BY_KEY.get(key as DomainKey)?.label ?? null;
}

/** Resolves a key the model returned, or null to discard it. */
export function canonicalDomain(raw: unknown): DomainKey | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  return BY_KEY.has(k as DomainKey) ? (k as DomainKey) : null;
}

/**
 * Sorts stored sections into the order above.
 *
 * The report's order is the product's, not the model's — otherwise the same
 * person's reports would reorder their own life between runs for no reason.
 */
export function domainOrder(key: string): number {
  const i = REPORT_DOMAINS.findIndex((d) => d.key === key);
  return i === -1 ? REPORT_DOMAINS.length : i;
}

/**
 * A short, stable fingerprint, folded into the stored report version.
 *
 * Readable rather than hashed, like the summariser's: "which list of areas
 * produced this report" is answerable by looking. Count plus first letters.
 */
export const DOMAIN_FINGERPRINT = `d${REPORT_DOMAINS.length}-${REPORT_DOMAINS.map(
  (d) => d.key[0]
).join("")}`;

/** The block the report prompt interpolates. */
export function domainPromptBlock(): string {
  return REPORT_DOMAINS.map((d) => `- \`${d.key}\` — ${d.gloss}`).join("\n");
}
