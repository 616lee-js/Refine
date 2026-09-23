import "server-only";
import { randomUUID } from "crypto";
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
): Promise<{ records: ArchiveRecord[]; categories: string[]; total: number }> {
  const entryDateBounds = [
    filters.from ? gte(journalEntries.createdAt, filters.from) : undefined,
    filters.to ? lte(journalEntries.createdAt, filters.to) : undefined,
  ].filter(Boolean);

  const responseDateBounds = [
    filters.from ? gte(questionnaireResponses.completedAt, filters.from) : undefined,
    filters.to ? lte(questionnaireResponses.completedAt, filters.to) : undefined,
  ].filter(Boolean);

  const [entries, responses] = await Promise.all([
    db
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
      .orderBy(desc(journalEntries.updatedAt)),

    db
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
      .orderBy(desc(questionnaireResponses.completedAt)),
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
        href: e.completedAt ? `/reflections/${e.id}` : `/reflection/${e.id}`,
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
        href: tracker ? `/checkin/${r.id}` : `/framework/${r.id}`,
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

  // Every category in play, for the picker — derived from the unfiltered set so
  // choosing one does not empty the list of the others.
  const categories = [
    ...new Set(all.flatMap((r) => r.categories.map((c) => c.trim()))),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

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

  const decrypted = categoriesByEntry.size + responses.length;
  if (decrypted > 0) {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId,
      context: `archive_rail_view (${categoriesByEntry.size} summaries, ${responses.length} responses read)`,
    });
  }

  return { records: records.slice(0, RAIL_LIMIT), categories, total: records.length };
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

  if (range === "7d") {
    from = startOfDay(now);
    from.setDate(from.getDate() - 6);
  } else if (range === "30d") {
    from = startOfDay(now);
    from.setDate(from.getDate() - 29);
  } else if (range === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (range === "custom") {
    // Date-only strings parse as UTC midnight; `to` is pushed to the end of its
    // day so a single-day range includes that day rather than nothing.
    const parsedFrom = params.from ? new Date(params.from) : null;
    const parsedTo = params.to ? new Date(params.to) : null;
    from = parsedFrom && !isNaN(parsedFrom.getTime()) ? parsedFrom : null;
    if (parsedTo && !isNaN(parsedTo.getTime())) {
      to = new Date(parsedTo);
      to.setHours(23, 59, 59, 999);
    }
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
