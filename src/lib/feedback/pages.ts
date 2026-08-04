/**
 * Which screen a piece of feedback came from.
 *
 * ── Patterns, never concrete paths ────────────────────────────────────────────
 * "/reflection/[id]", never "/reflection/9f3c-...".
 *
 * A raw pathname would tie an unattributed submission to one specific journal
 * entry, and through that entry to whoever wrote it. That would quietly undo the
 * reason `feedback` has no `user_id` at all. The pattern keeps the useful part —
 * which surface the person was on — and drops the part that identifies them.
 *
 * ── The allowlist is the mechanism ────────────────────────────────────────────
 * Normalisation runs on the SERVER against this list. The client sends a
 * pathname, but nothing it sends is stored: an unrecognised route records NULL
 * rather than being written through. That means a future route cannot leak an
 * identifier into this column by being added without thought, and a caller
 * cannot post an arbitrary string into it.
 */

/**
 * Every route that can render the feedback widget — i.e. everything under the
 * `(protected)` group. Segments in brackets match one path segment.
 *
 * Add a route here when adding a page. Missing one costs a NULL, not a leak.
 */
const KNOWN_ROUTES = [
  "/",
  "/onboarding",
  "/reflection/[id]",
  "/reflections",
  "/reflections/[id]",
  "/mirror",
  "/checkin/[id]",
  "/framework/[id]",
  "/settings/profile",
  "/settings/system-prompt",
  "/trash",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

/** Human labels for the admin view. */
export const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/onboarding": "Onboarding",
  "/reflection/[id]": "Writing an entry",
  "/reflections": "Archive",
  "/reflections/[id]": "Reading an entry",
  "/mirror": "Mirror",
  "/checkin/[id]": "Daily check-in",
  "/framework/[id]": "Framework questionnaire",
  "/settings/profile": "Profile settings",
  "/settings/system-prompt": "System prompt",
  "/trash": "Trash",
};

/**
 * Resolves a pathname to a known route pattern, or null.
 *
 * Query strings and trailing slashes are discarded — `/mirror?tab=trends` is
 * still the Mirror screen, and the tab is not worth a distinct value.
 */
export function normalisePath(raw: unknown): KnownRoute | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;

  const path = raw.split("?")[0].split("#")[0];
  const segments = path.split("/").filter(Boolean);

  for (const route of KNOWN_ROUTES) {
    const routeSegments = route.split("/").filter(Boolean);
    if (routeSegments.length !== segments.length) continue;

    const matches = routeSegments.every(
      (seg, i) => seg.startsWith("[") || seg === segments[i]
    );
    if (matches) return route;
  }

  return null;
}

/** Label for display. Falls back to the pattern, then to a plain statement. */
export function pageLabel(page: string | null): string {
  if (!page) return "Unknown screen";
  return PAGE_LABELS[page] ?? page;
}
