import { getSession } from "@/lib/auth";
import { loadRail } from "@/app/(protected)/reflections/records";

/**
 * The archive's record list, for the list component to refetch when its filters
 * change.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The list lives in `reflections/layout.tsx` so it survives navigation between
 * records. A layout is not given the URL's search parameters, so it cannot
 * filter — the list reads those itself, on the client, and asks here for the
 * matching records. Without this the filters would have to be a page
 * navigation, which is what made every click rebuild the whole screen.
 *
 * ── It returns descriptions, never content ────────────────────────────────────
 * Same shape the layout renders on first load: card titles, categories and
 * check-in values. No entry bodies — `loadRecords` does not decrypt them, for
 * the reason recorded there.
 *
 * `loadRail` writes the one `content_access_log` row for the read, so a filter
 * change is audited exactly as the initial page load is.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const get = (k: string) => url.searchParams.get(k) ?? undefined;

  const rail = await loadRail(session.userId, {
    filter: get("filter"),
    category: get("category"),
    range: get("range"),
    from: get("from"),
    to: get("to"),
    q: get("q"),
  });

  return Response.json({
    records: rail.records,
    categories: rail.categories,
    total: rail.total,
    capped: rail.capped,
  });
}
