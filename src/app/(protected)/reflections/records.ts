import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  journalEntries,
  journalEntrySummaries,
  questionnaireResponses,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, type Answers } from "@/lib/questionnaires";
import { authoritativeSummary } from "@/lib/summaries/read";

/**
 * The records behind the archive rail.
 *
 * Shared by `/reflections` and `/reflections/[id]`, which render the same rail —
 * one is the rail with nothing selected, the other the rail with a record open
 * in the main view. Loading it in one place is what stops the two drifting.
 *
 * ── Decryption is bounded and logged once ─────────────────────────────────────
 * Subheaders need each listed record's categories (writing) or answers
 * (check-in), so this decrypts per record. Bodies are NOT decrypted — an excerpt
 * would mean reading every entry to draw a list, which is a different act from
 * reading the description of one.
 *
 * Two consequences follow, and both are deliberate:
 *
 * 1. **The rail is capped.** It now renders on every entry view, not just on the
 *    archive, so an uncapped rail would multiply decryptions by every page turn.
 * 2. **One `content_access_log` row per page**, carrying the count. A row per
 *    record would put fifty entries on the board for a single glance and bury
 *    the log in the noise it exists to make visible. Same rule as Trends and the
 *    check-in panel.
 */

export const RAIL_LIMIT = 50;

/**
 * How many categories the picker offers.
 *
 * Categories are specific phrases today rather than buckets (the summariser v2
 * prompt that would fix that is deferred — see docs/build-notes.md), so the
 * distinct set grows roughly with the number of entries. Uncapped, a long
 * archive emits thousands of `<option>` elements for a control nobody can use.
 * Capped and ordered by frequency, whatever is genuinely reusable floats to the
 * top and the one-off tail is simply absent.
 */
export const CATEGORY_LIMIT = 50;

export type CategoryOption = { value: string; count: number };

export type RecordKind = "open" | "framework" | "checkin";

export type ArchiveRecord = {
  id: string;
  href: string;
  at: Date;
  kind: RecordKind;
  /** "Writing", "Check-in", "GAD-7" — what the card is titled with. */
  kindLabel: string;
  /** Categories, or a check-in's values. The card's subheader. */
  detail: string[];
  /** Categories only — what the category filter matches on. */
  categories: string[];
  /** The user's own title, shown in the main view, never on the card. */
  title: string | null;
  draft: boolean;
  awaitingSummary: boolean;
};

export type RecordFilters = {
  kind: RecordKind | "all";
  category: string | null;
  from: Date | null;
  to: Date | null;
  q: string | null;
};

/** A check-in's values, in the instrument's own order. */
function trackerDetail(slug: string, answers: Answers): string[] {
  const q = getQuestionnaire(slug);
  if (!q || q.kind !== "tracker") return [];

  const parts: string[] = [];
  for (const field of q.fields) {
    const value = answers[field.key];
    if (value === undefined) continue;
    if (field.kind === "count" && typeof value === "number") {
      parts.push(`${field.label} ${value}${field.unit ?? ""}`);
    } else if (field.kind === "scale" && typeof value === "number") {
      parts.push(`${field.label} ${value}/${field.steps}`);
    } else if (field.kind === "toggles" && typeof value === "object") {
      const on = field.options
        .filter((o) => (value as Record<string, boolean>)[o.key])
        .map((o) => o.label);
      if (on.length > 0) parts.push(on.join(" · "));
    }
  }
  return parts;
}

/**
 * Every record the rail can show, newest first, already decrypted.
 *
 * Filtering happens after loading rather than in SQL because categories live
 * inside an encrypted blob — there is nothing for Postgres to filter on. The
 * date bounds ARE applied in SQL, since those are real columns and narrowing
 * there is what keeps the decryption count down.
 */
export async function loadRecords(
  userId: string,
  filters: RecordFilters
): Promise<{
  records: ArchiveRecord[];
  categories: CategoryOption[];
  total: number;
  /** The row limit cut the list short, so `total` is a floor, not a total. */
  capped: boolean;
}> {
  const entryDateBounds = [
    filters.from ? gte(journalEntries.createdAt, filters.from) : undefined,
    filters.to ? lte(journalEntries.createdAt, filters.to) : undefined,
  ].filter(Boolean);

  const responseDateBounds = [
    filters.from ? gte(questionnaireResponses.completedAt, filters.from) : undefined,
    filters.to ? lte(questionnaireResponses.completedAt, filters.to) : undefined,
  ].filter(Boolean);

  /*
   * How much to load.
   *
   * ── The common case is bounded ──────────────────────────────────────────────
   * Both lists come back newest-first, so taking RAIL_LIMIT from each and
   * merging still yields the true newest RAIL_LIMIT of the union — one list
   * cannot hide a record newer than the other's cut-off.
   *
   * This used to fetch EVERYTHING, decrypt every title, category set and
   * check-in answer, and only then slice. The cap was on what was displayed
   * rather than on what was done, so the cost grew with total history on every
   * record view — the rail renders on all of them.
   *
   * ── Search and category are deliberately not bounded ────────────────────────
   * Categories and titles live inside encrypted blobs, so Postgres cannot
   * filter on them; the matching happens here, after decryption. Applying a
   * limit first would silently drop older matches and make search quietly
   * wrong. So an explicit search stays exhaustive and pays for it, while the
   * ordinary case — no filter — is fast.
   */
  const needsFullScan = filters.category !== null || filters.q !== null;
  const rowLimit = needsFullScan ? undefined : RAIL_LIMIT;

  const entryQuery = db
    .select({
      id: journalEntries.id,
      createdAt: journalEntries.createdAt,
      updatedAt: journalEntries.updatedAt,
      completedAt: journalEntries.completedAt,
      encryptedTitle: journalEntries.encryptedTitle,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, userId),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt),
        ...entryDateBounds
      )
    )
    .orderBy(desc(journalEntries.updatedAt))
    .$dynamic();

  const responseQuery = db
    .select({
      id: questionnaireResponses.id,
      slug: questionnaireResponses.questionnaireSlug,
      createdAt: questionnaireResponses.createdAt,
      completedAt: questionnaireResponses.completedAt,
      encryptedAnswers: questionnaireResponses.encryptedAnswers,
    })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, userId),
        // Unlike entries, an unfinished questionnaire is not listed. A drafted
        // GAD-7 is a half-answered form, not a piece of writing to come back
        // to — surfacing it invites completing it days later, which would make
        // the recall window meaningless.
        isNotNull(questionnaireResponses.completedAt),
        isNull(questionnaireResponses.deletedAt),
        isNull(questionnaireResponses.purgedAt),
        ...responseDateBounds
      )
    )
    .orderBy(desc(questionnaireResponses.completedAt))
    .$dynamic();

  const [entries, responses] = await Promise.all([
    rowLimit ? entryQuery.limit(rowLimit) : entryQuery,
    rowLimit ? responseQuery.limit(rowLimit) : responseQuery,
  ]);

  const entryIds = entries.map((e) => e.id);
  const summaryRows = entryIds.length
    ? await db
        .select({
          journalEntryId: journalEntrySummaries.journalEntryId,
          encryptedContent: journalEntrySummaries.encryptedContent,
          encryptedUserContent: journalEntrySummaries.encryptedUserContent,
          userEditedAt: journalEntrySummaries.userEditedAt,
          generatedAt: journalEntrySummaries.generatedAt,
          generationVersion: journalEntrySummaries.generationVersion,
        })
        .from(journalEntrySummaries)
        .where(inArray(journalEntrySummaries.journalEntryId, entryIds))
    : [];

  let failures = 0;

  const categoriesByEntry = new Map<string, string[]>();
  for (const row of summaryRows) {
    try {
      // Through authoritativeSummary, so a corrected summary's categories are
      // what the rail shows — never the version the user already fixed.
      categoriesByEntry.set(
        row.journalEntryId,
        authoritativeSummary(row).summary.topics
      );
    } catch {
      failures += 1;
    }
  }

  const all: ArchiveRecord[] = [
    ...entries.map((e): ArchiveRecord => {
      let title: string | null = null;
      if (e.encryptedTitle) {
        try {
          title = decrypt(e.encryptedTitle);
        } catch {
          // A title that will not decrypt is not worth failing a whole list
          // over. The record still opens, and the read view reports the problem
          // properly when the body fails too.
          failures += 1;
        }
      }
      const categories = categoriesByEntry.get(e.id) ?? [];
      return {
        id: e.id,
        // Both stay inside the archive: a finished entry opens to read, an
        // unfinished one opens straight into the editor. Home's "pick it back
        // up" still uses the standalone screen — resuming a blank-ish draft is
        // closer to starting one than to editing something that exists.
        href: e.completedAt
          ? `/reflections/${e.id}`
          : `/reflections/${e.id}/edit`,
        at: e.completedAt ?? e.updatedAt,
        kind: "open",
        kindLabel: "Writing",
        detail: categories,
        categories,
        title,
        draft: !e.completedAt,
        awaitingSummary: e.completedAt !== null && !categoriesByEntry.has(e.id),
      };
    }),
    ...responses.map((r): ArchiveRecord => {
      const q = getQuestionnaire(r.slug);
      const tracker = q?.kind === "tracker";

      let detail: string[] = [];
      if (tracker && r.encryptedAnswers) {
        try {
          const answers =
            (JSON.parse(decrypt(r.encryptedAnswers)) as { answers?: Answers })
              .answers ?? {};
          detail = trackerDetail(r.slug, answers);
        } catch {
          failures += 1;
        }
      }

      return {
        id: r.id,
        // Inside the archive, not the standalone screens. Those redirect here
        // now — a record opens in the main view rather than navigating away.
        href: tracker
          ? `/reflections/checkin/${r.id}`
          : `/reflections/framework/${r.id}`,
        at: r.completedAt ?? r.createdAt,
        kind: tracker ? "checkin" : "framework",
        kindLabel: q?.shortName ?? r.slug,
        detail,
        categories: [],
        // A questionnaire's name is the instrument's, not the user's.
        title: q?.title ?? r.slug,
        draft: false,
        awaitingSummary: false,
      };
    }),
  ];

  if (failures > 0) {
    console.error(
      `Archive: ${failures} record(s) failed to decrypt for user ${userId}`
    );
  }

  /*
   * The picker's options — derived from the unfiltered set, so choosing one
   * does not empty the list of the others.
   *
   * Counted and ordered most-used first rather than alphabetically. With
   * categories as specific as they currently are, alphabetical order buries the
   * few that recur among a long tail of one-offs; frequency puts the usable
   * ones first. Ties break alphabetically so the order is stable.
   *
   * ── Scoped to what was loaded ───────────────────────────────────────────────
   * Since the unfiltered load is bounded (see above), these are the categories
   * present in the most recent RAIL_LIMIT records, not in the whole archive. A
   * category that appears only in much older writing is not offered.
   *
   * That is the price of not decrypting the entire archive on every record
   * view, and it mostly resolves itself: once categories become broad groupings
   * rather than one-off phrases, the handful of real ones all appear in recent
   * records anyway. Search is the exhaustive path in the meantime — it scans
   * everything precisely so nothing old becomes unreachable.
   */
  const counts = new Map<string, number>();
  for (const r of all) {
    for (const c of r.categories) {
      const key = c.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const categories: CategoryOption[] = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, CATEGORY_LIMIT);

  const records = all
    .filter((r) => filters.kind === "all" || r.kind === filters.kind)
    .filter(
      (r) =>
        !filters.category ||
        r.categories.some(
          (c) => c.toLowerCase() === filters.category!.toLowerCase()
        )
    )
    .filter((r) => {
      if (!filters.q) return true;
      const needle = filters.q.toLowerCase();
      return (
        (r.title?.toLowerCase().includes(needle) ?? false) ||
        r.categories.some((c) => c.toLowerCase().includes(needle)) ||
        r.kindLabel.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  /*
   * Off the rendering path.
   *
   * This is a genuine decryption and it is genuinely logged — but the page has
   * no reason to wait for the write before showing anything. `after()` keeps
   * the function alive until it lands, which is the same mechanism the
   * summariser uses; see src/lib/after-response.ts for why an un-awaited
   * promise would not be safe here.
   */
  const decrypted = categoriesByEntry.size + responses.length;
  if (decrypted > 0) {
    after(async () => {
      try {
        await db.insert(contentAccessLog).values({
          id: randomUUID(),
          userId,
          context: `archive_rail_view (${categoriesByEntry.size} summaries, ${responses.length} responses read)`,
        });
      } catch (err) {
        // The response is already sent; there is nobody left to report to, and
        // a failed audit write must not take down a page that rendered fine.
        console.error(
          "Archive rail access log failed:",
          err instanceof Error ? err.message : err
        );
      }
    });
  }

  /*
   * `capped` says the list was cut short by the row limit rather than by the
   * filters, so the count can say "50+" instead of claiming 50 is the total.
   * Counting properly would mean extra queries per view for a label; saying
   * "at least this many" is honest and free.
   */
  const capped =
    rowLimit !== undefined &&
    (entries.length === rowLimit || responses.length === rowLimit);

  return {
    records: records.slice(0, RAIL_LIMIT),
    categories,
    total: records.length,
    capped,
  };
}

/** The filter parameters every archive page accepts. */
export type ArchiveSearchParams = {
  filter?: string;
  category?: string;
  range?: string;
  from?: string;
  to?: string;
  q?: string;
};

/**
 * Everything an archive page needs to draw the rail, in one call.
 *
 * Shared so the three pages cannot derive the view differently — a rail that
 * disagrees with its own filters between routes would be a quiet, confusing
 * bug. Returns the `RailView` shape that `record-rail.tsx` takes.
 */
export async function loadRail(userId: string, params: ArchiveSearchParams) {
  const { range, ...filters } = parseFilters(params);
  const { records, categories, total, capped } = await loadRecords(
    userId,
    filters
  );

  return {
    records,
    categories,
    total,
    capped,
    view: {
      kind: filters.kind,
      range,
      from: params.from ?? null,
      to: params.to ?? null,
      category: filters.category,
      q: filters.q,
    },
  };
}

/** Parses the URL into filters. Unknown values fall back rather than erroring. */
export function parseFilters(params: {
  filter?: string;
  category?: string;
  range?: string;
  from?: string;
  to?: string;
  q?: string;
}): RecordFilters & { range: string } {
  const kind: RecordKind | "all" =
    params.filter === "open" ||
    params.filter === "framework" ||
    params.filter === "checkin"
      ? params.filter
      : "all";

  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  let from: Date | null = null;
  let to: Date | null = null;
  const range = params.range ?? "all";

  /*
   * Typed dates win over the preset.
   *
   * The previous rule honoured `from`/`to` only when `range=custom`, which made
   * the visible control depend on a hidden one: typing a date did nothing
   * unless a preset elsewhere had already been set to "custom". Now a date
   * present in the URL IS the range, and the preset applies only when no date
   * was typed. There is no `custom` mode left to get out of step.
   *
   * Date-only strings parse as UTC midnight; `to` is pushed to the end of its
   * day so a single-day range includes that day rather than nothing.
   */
  const parsedFrom = params.from ? new Date(params.from) : null;
  const parsedTo = params.to ? new Date(params.to) : null;
  const hasFrom = parsedFrom !== null && !isNaN(parsedFrom.getTime());
  const hasTo = parsedTo !== null && !isNaN(parsedTo.getTime());

  if (hasFrom || hasTo) {
    if (hasFrom) from = parsedFrom;
    if (hasTo) {
      to = new Date(parsedTo!);
      to.setHours(23, 59, 59, 999);
    }
  } else if (range === "7d") {
    from = startOfDay(now);
    from.setDate(from.getDate() - 6);
  } else if (range === "30d") {
    from = startOfDay(now);
    from.setDate(from.getDate() - 29);
  } else if (range === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  }

  return {
    kind,
    category:
      typeof params.category === "string" && params.category.trim()
        ? params.category.trim()
        : null,
    from,
    to,
    q: typeof params.q === "string" && params.q.trim() ? params.q.trim() : null,
    range,
  };
}
