import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  journalEntries,
  journalEntryCategories,
  journalEntrySummaries,
  questionnaireResponses,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, maxTotal, type Answers } from "@/lib/questionnaires";
import {
  categoriesForEntries,
  listCategories,
  type Category,
} from "@/lib/journal/categories";
import {
  addDays,
  dayEnd,
  dayStart,
  fmtDateWeekday,
  localDay,
  monthStartOf,
  parseLocalDay,
} from "@/lib/time";
import { timeZoneFor } from "@/lib/time-zone";

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
  /**
   * The date as the card prints it, formatted HERE and never on the client.
   *
   * RecordCard is rendered by the record rail, which is a client component, so
   * anything it formats runs twice — once on the server and once at hydration.
   * `toLocaleDateString` resolves the host's locale and timezone, and those
   * differ between a server in UTC and a browser anywhere else, so the two
   * passes produced different text and React threw a hydration error that took
   * down the whole route. Formatting once, server-side, and sending the string
   * is what the check-in page already does with `today`.
   */
  dateLabel: string;
  kind: RecordKind;
  /** "Writing", "Check-in", "GAD-7" — what the card is titled with. */
  kindLabel: string;
  /** Categories, or a check-in's values. The card's subheader. */
  detail: string[];
  /** Category names only — what the category filter matches on. */
  categories: string[];
  /** The same categories with their ids, for the control on the card. */
  tags: Category[];
  /** Marked sensitive by the person. Shown; kept out of Mirror and Trends. */
  sensitive: boolean;
  /** The user's own title, shown in the main view, never on the card. */
  title: string | null;
  draft: boolean;
  awaitingSummary: boolean;
};

/** Server-side only, in the person's zone. See the note on `dateLabel` and lib/time.ts. */
export function formatRecordDate(at: Date, tz: string): string {
  return fmtDateWeekday(at, tz);
}

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
 * Search happens after loading rather than in SQL because titles live
 * inside an encrypted blob — there is nothing for Postgres to filter on. The
 * date bounds ARE applied in SQL, since those are real columns and narrowing
 * there is what keeps the decryption count down.
 */
export async function loadRecords(
  userId: string,
  filters: RecordFilters,
  tz: string
): Promise<{
  records: ArchiveRecord[];
  categories: CategoryOption[];
  userCategories: Category[];
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
   * ── Search is deliberately not bounded ──────────────────────────────────────
   * Titles live inside encrypted blobs, so Postgres cannot filter on them; the
   * matching happens here, after decryption. Applying a limit first would
   * silently drop older matches and make search quietly wrong. So an explicit
   * search stays exhaustive and pays for it, while the ordinary case — no
   * filter — is fast. A category filter is a join (below) and stays bounded.
   */
  const needsFullScan = filters.q !== null;
  const rowLimit = needsFullScan ? undefined : RAIL_LIMIT;

  /*
   * The person's categories, read once: they are the filter's options, the
   * names on every card, and — when a category is being filtered on — the id
   * to filter by. Categories are rows now rather than words inside an
   * encrypted summary, so the category filter is a join rather than a scan.
   */
  const userCategories = await listCategories(userId);
  const filterCategory = filters.category
    ? userCategories.find(
        (c) => c.name.toLowerCase() === filters.category!.toLowerCase()
      ) ?? null
    : null;

  const entryQuery = db
    .select({
      id: journalEntries.id,
      createdAt: journalEntries.createdAt,
      updatedAt: journalEntries.updatedAt,
      completedAt: journalEntries.completedAt,
      encryptedTitle: journalEntries.encryptedTitle,
      sensitiveAt: journalEntries.sensitiveAt,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, userId),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt),
        ...entryDateBounds,
        // A category that matches nothing matches nothing — not everything.
        filters.category
          ? inArray(
              journalEntries.id,
              db
                .select({ id: journalEntryCategories.journalEntryId })
                .from(journalEntryCategories)
                .where(
                  eq(journalEntryCategories.categoryId, filterCategory?.id ?? "")
                )
            )
          : undefined
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
      encryptedScoring: questionnaireResponses.encryptedScoring,
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
    // Check-ins and frameworks carry no categories, so a category filter
    // excludes them outright.
    filters.category
      ? Promise.resolve([] as Awaited<typeof responseQuery>)
      : rowLimit
        ? responseQuery.limit(rowLimit)
        : responseQuery,
  ]);

  const entryIds = entries.map((e) => e.id);

  /*
   * Until 2026-11-12 this decrypted every entry's summary to read its
   * categories off it. Categories are the person's own rows now, so the only
   * thing a summary row tells this list is that it exists — which is all the
   * "summarising…" marker needs, and it needs no decryption to learn it.
   */
  const [summarised, tagsByEntry] = await Promise.all([
    entryIds.length
      ? db
          .select({ journalEntryId: journalEntrySummaries.journalEntryId })
          .from(journalEntrySummaries)
          .where(inArray(journalEntrySummaries.journalEntryId, entryIds))
          .then((rows) => new Set(rows.map((r) => r.journalEntryId)))
      : new Set<string>(),
    categoriesForEntries(userId, entryIds),
  ]);

  let failures = 0;

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
      const tags = tagsByEntry.get(e.id) ?? [];
      const categories = tags.map((t) => t.name);
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
        dateLabel: formatRecordDate(e.completedAt ?? e.updatedAt, tz),
        kind: "open",
        kindLabel: "Writing",
        detail: categories,
        categories,
        tags,
        sensitive: e.sensitiveAt !== null,
        title,
        draft: !e.completedAt,
        awaitingSummary: e.completedAt !== null && !summarised.has(e.id),
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
      } else if (q?.kind === "likert" && r.encryptedScoring) {
        /*
         * The score, out of the total possible — "12 / 21" — on the card.
         *
         * From the stored scoring, not the answers: it carries the per-item
         * values, so "every item answered" can be checked without a second
         * decrypt. A partial response shows nothing, because its low total
         * looks like a real reading. Same rows, same access-log count.
         */
        try {
          const scoring = JSON.parse(decrypt(r.encryptedScoring)) as {
            total?: number;
            items?: Record<string, number>;
          };
          const answered = Object.keys(scoring.items ?? {}).length;
          if (typeof scoring.total === "number" && answered === q.items.length) {
            detail = [`${scoring.total} / ${maxTotal(q)}`];
          }
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
        dateLabel: formatRecordDate(r.completedAt ?? r.createdAt, tz),
        kind: tracker ? "checkin" : "framework",
        kindLabel: q?.shortName ?? r.slug,
        detail,
        categories: [],
        tags: [],
        sensitive: false,
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
   * The filter's options: every category the person has, most used first,
   * with how many live entries carry it. Exhaustive — counted from the link
   * table, not from the records that happened to load — because a category
   * on only older writing must still be offered.
   */
  const categories: CategoryOption[] = userCategories
    .filter((c) => c.count > 0)
    .map((c) => ({ value: c.name, count: c.count }))
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
  const decrypted = userCategories.length + responses.length;
  if (decrypted > 0) {
    after(async () => {
      try {
        await db.insert(contentAccessLog).values({
          id: randomUUID(),
          userId,
          context: `archive_rail_view (${userCategories.length} category names, ${responses.length} responses read)`,
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
    // For the category control on each card: ids as well as names.
    userCategories: userCategories.map(({ id, name }) => ({ id, name })),
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
  // Day boundaries and date labels are the person's, not the server's.
  const tz = await timeZoneFor(userId);
  const { range, ...filters } = parseFilters(params, tz);
  const { records, categories, userCategories, total, capped } = await loadRecords(
    userId,
    filters,
    tz
  );

  return {
    records,
    categories,
    userCategories,
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
}, tz: string): RecordFilters & { range: string } {
  const kind: RecordKind | "all" =
    params.filter === "open" ||
    params.filter === "framework" ||
    params.filter === "checkin"
      ? params.filter
      : "all";

  // "Today" in the person's zone. See lib/time.ts.
  const today = localDay(new Date(), tz);

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
   * A typed date is a calendar day in the person's zone, so it starts at their
   * midnight and `to` runs to the end of that day — a single-day range includes
   * the day rather than nothing.
   */
  const fromDay = parseLocalDay(params.from);
  const toDay = parseLocalDay(params.to);

  if (fromDay || toDay) {
    if (fromDay) from = dayStart(fromDay, tz);
    if (toDay) to = dayEnd(toDay, tz);
  } else if (range === "7d") {
    from = dayStart(addDays(today, -6), tz);
  } else if (range === "30d") {
    from = dayStart(addDays(today, -29), tz);
  } else if (range === "month") {
    from = dayStart(monthStartOf(today), tz);
  } else if (range === "year") {
    from = dayStart(today.slice(0, 4) + "-01-01", tz);
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
