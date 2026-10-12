import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mirrorReviews } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { canonicalDomain, domainOrder } from "@/lib/mirror/domains";
import { serialiseReport, type StructuredReport } from "@/lib/mirror/read";

/**
 * Editing a Mirror report.
 *
 * ── Their version wins ────────────────────────────────────────────────────────
 * A report is Refine's account of a person. When they rewrite it, the rewrite is
 * what Mirror shows and what the next run builds on — see
 * `authoritativeReport()` in src/lib/mirror/read.ts, which is the only place
 * that rule lives.
 *
 * The generated version is never overwritten. It stays in `encrypted_report` so
 * an edit can be compared against what prompted it, and reverted.
 *
 * ── Reverting ─────────────────────────────────────────────────────────────────
 * Sending `report: null` clears the edit rather than storing an empty report.
 * "Put it back how it was" is a thing people want, and an empty report would
 * otherwise be indistinguishable from a blank one Refine had written.
 *
 * ── It takes the whole report, not one part ───────────────────────────────────
 * The report is an overall account plus a section per area of life, and the panel
 * edits one part at a time — but it sends all of it. The alternative is a route
 * that patches a part, which means the server deciding how to merge into an
 * encrypted blob it would have to decrypt first. Sending the whole object keeps
 * the merge in the one place that already holds the report.
 *
 * Validated into shape rather than trusted: this is a request body, and whatever
 * lands here becomes the account the next run builds on.
 */

/** A report someone has rewritten by hand is not a place to paste a novel. */
const MAX_PART_CHARS = 20_000;
/** Seven areas plus some slack. A report cannot grow sections it has no names for. */
const MAX_SECTIONS = 16;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { report } = body as { report?: unknown };

  // Explicit null is the revert. `undefined` is a malformed request, and the two
  // must not be conflated — one clears someone's rewrite.
  if (report !== null && (typeof report !== "object" || report === undefined)) {
    return new Response("report required", { status: 400 });
  }

  let stored: StructuredReport | null = null;
  if (report !== null) {
    const { overall, sections, figures } = report as Record<string, unknown>;

    if (typeof overall !== "string" || !overall.trim()) {
      return new Response("The report cannot be empty", { status: 400 });
    }
    if (overall.length > MAX_PART_CHARS) {
      return new Response("Too long", { status: 413 });
    }
    if (!Array.isArray(sections) || sections.length > MAX_SECTIONS) {
      return new Response("Bad sections", { status: 400 });
    }

    const clean: { domain: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const s of sections) {
      if (typeof s !== "object" || s === null) {
        return new Response("Bad sections", { status: 400 });
      }
      const { domain, text } = s as { domain?: unknown; text?: unknown };
      /*
       * The area must be one of ours. An unknown key would store a section the
       * panel cannot label and nothing can join to a score — and the list is
       * closed precisely so that is impossible.
       */
      const key = canonicalDomain(domain);
      if (!key || seen.has(key)) {
        return new Response("Bad sections", { status: 400 });
      }
      if (typeof text !== "string" || text.length > MAX_PART_CHARS) {
        return new Response("Bad sections", { status: 400 });
      }
      // An emptied section is dropped rather than stored blank: deleting the text
      // is how someone removes an area they disagree with.
      if (!text.trim()) continue;
      seen.add(key);
      clean.push({ domain: key, text: text.trim() });
    }
    clean.sort((a, b) => domainOrder(a.domain) - domainOrder(b.domain));

    /*
     * The figures are Trends' own strings and are not the person's to rewrite —
     * the whole point of carrying them verbatim is that the report and the chart
     * cannot disagree about a number. Accepted from the body only as strings, and
     * the panel offers no editor for them.
     */
    stored = {
      overall: overall.trim(),
      sections: clean,
      figures: Array.isArray(figures)
        ? figures.filter((f): f is string => typeof f === "string")
        : [],
    };
  }

  // Ownership re-checked: `id` comes from the URL and is untrusted.
  const [row] = await db
    .select({ id: mirrorReviews.id })
    .from(mirrorReviews)
    .where(and(eq(mirrorReviews.id, id), eq(mirrorReviews.userId, session.userId)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  await db
    .update(mirrorReviews)
    .set(
      stored
        ? {
            encryptedUserReport: encrypt(serialiseReport(stored)),
            userEditedAt: new Date(),
          }
        : // Revert: back to what Refine wrote, with no trace of an edit.
          { encryptedUserReport: null, userEditedAt: null }
    )
    .where(eq(mirrorReviews.id, id));

  return Response.json({
    savedAt: new Date().toISOString(),
    edited: Boolean(stored),
  });
}

/**
 * Deletes a report.
 *
 * ── Genuine deletion, not hiding ──────────────────────────────────────────────
 * The row goes. The report text, the person's edit of it, and that window's
 * note all go with it, because they are one row and all three are Refine's
 * account of them. Nothing is archived and there is no undo.
 *
 * That is the right shape for this specific thing: a report is derived, it can
 * be produced again from the writing it was drawn from, and the writing itself
 * is untouched. Nothing else in the app references a report, so there is no log
 * left pointing at a hole.
 *
 * Deleting the newest report reveals the one before it, if there is one.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  // Ownership is enforced in the delete itself, so a miss is either "not yours"
  // or "does not exist" — neither of which this needs to distinguish.
  await db
    .delete(mirrorReviews)
    .where(and(eq(mirrorReviews.id, id), eq(mirrorReviews.userId, session.userId)));

  return new Response(null, { status: 204 });
}
