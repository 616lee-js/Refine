import Link from "next/link";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
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
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * The archive — every record, both shapes.
 *
 * ── What a card says ──────────────────────────────────────────────────────────
 * Header: the date and what kind of record it is. Body: the title where the
 * writer set one. Subheader: what the record is *about* — the summary's topics
 * for a piece of writing, the day's values for a check-in.
 *
 * The date used to appear twice on writing entries: once in the date column and
 * again as the fallback title. An untitled entry now shows its topics instead,
 * which is the thing that distinguishes one Tuesday from another.
 *
 * ── Decryption here is deliberate, and logged once ────────────────────────────
 * Rendering subheaders means decrypting each listed record's summary (or, for a
 * check-in, its answers). The bodies are NOT decrypted — an excerpt would mean
 * reading every entry to draw a list, and that is a different act from reading
 * the description of one.
 *
 * `content_access_log` gets ONE row for the page, carrying the count, on the
 * same reasoning as Mirror's Trends view: this is a single deliberate act by the
 * owner of the data, and a row per record would bury the log in noise it exists
 * to make visible.
 */

// COPY REVIEW: shipped wording hoisted; `[COPY]` items are placeholders.
const COPY = {
  headline: "Everything you've written",
  records: (n: number) => `${n} ${n === 1 ? "record" : "records"}`,
  since: (month: string) => ` · since ${month}`,
  filterAll: "All",
  filterWriting: "Writing",
  filterFramework: "Framework",
  filterCheckins: "Check-ins",
  sortNewest: "[COPY] Newest first",
  sortOldest: "[COPY] Oldest first",
  searchLabel: "[COPY] Search your records",
  searchPlaceholder: "[COPY] Search titles and topics",
  searchSubmit: "[COPY] Search",
  searchClear: "[COPY] Clear search",
  searchingFor: (q: string) => `[COPY] Matching “${q}”`,
  emptySearch: "[COPY] Nothing matches that.",
  unfinished: "Unfinished",
  untitled: "[COPY] Untitled",
  summarising: "[COPY] Summarising…",
  topicFilter: (topic: string) => `[COPY] About “${topic}”`,
  clearTopic: "[COPY] Clear",
  emptyAll: "Nothing here yet.",
  emptyFiltered: "Nothing of this kind yet.",
  emptyTopic: "[COPY] Nothing about this yet.",
  start: "Start something",
} as const;

type Filter = "all" | "open" | "framework" | "checkin";
type Sort = "newest" | "oldest";

type Row = {
  id: string;
  href: string;
  at: Date;
  title: string | null;
  /** Generated categories, or a check-in's values. Rendered under the title. */
  detail: string[];
  /** Topics only — what the topic filter matches on. */
  topics: string[];
  kind: Exclude<Filter, "all">;
  kindLabel: string;
  draft: boolean;
  /** Completed, but Cabinet 2 has not caught up yet. */
  awaitingSummary: boolean;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: COPY.filterAll },
  { key: "open", label: COPY.filterWriting },
  { key: "framework", label: COPY.filterFramework },
  { key: "checkin", label: COPY.filterCheckins },
];

type View = { filter: Filter; sort: Sort; topic: string | null; q: string | null };

/** Preserves the other parameters when one of them changes. */
function hrefWith(current: View, change: Partial<View>): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.filter !== "all") params.set("filter", next.filter);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.topic) params.set("topic", next.topic);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `/reflections?${qs}` : "/reflections";
}

/** A check-in's values, in the instrument's own order. Mirrors the side panel. */
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

export default async function ReflectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    sort?: string;
    topic?: string;
    q?: string;
  }>;
}) {
  const {
    filter: rawFilter,
    sort: rawSort,
    topic: rawTopic,
    q: rawQuery,
  } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === rawFilter)
    ? (rawFilter as Filter)
    : "all";
  const sort: Sort = rawSort === "oldest" ? "oldest" : "newest";
  const topic = typeof rawTopic === "string" && rawTopic.trim() ? rawTopic.trim() : null;
  const query =
    typeof rawQuery === "string" && rawQuery.trim() ? rawQuery.trim() : null;

  const authSession = await getSession();
  const userId = authSession.userId!;

  // Trashed and purged rows are excluded from both queries. `deleted_at` covers
  // both, since purge leaves it set — but `purged_at` is checked explicitly so
  // the intent survives any future change to that.
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
          isNull(journalEntries.purgedAt)
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
          isNull(questionnaireResponses.purgedAt)
        )
      )
      .orderBy(desc(questionnaireResponses.completedAt)),
  ]);

  // Summaries for the listed entries, in one query rather than per row.
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

  let decryptFailures = 0;

  const topicsByEntry = new Map<string, string[]>();
  for (const row of summaryRows) {
    try {
      // Through authoritativeSummary, so a corrected summary's topics are what
      // the archive shows — never the version the user already fixed.
      topicsByEntry.set(row.journalEntryId, authoritativeSummary(row).summary.topics);
    } catch {
      decryptFailures += 1;
    }
  }

  const rows: Row[] = [
    ...entries.map((e): Row => {
      let title: string | null = null;
      if (e.encryptedTitle) {
        try {
          title = decrypt(e.encryptedTitle);
        } catch {
          // A title that will not decrypt is not worth failing a whole list
          // over. The row still opens, and the read view reports the problem
          // properly when the body fails too.
          decryptFailures += 1;
          title = null;
        }
      }
      const topics = topicsByEntry.get(e.id) ?? [];
      return {
        id: e.id,
        href: e.completedAt ? `/reflections/${e.id}` : `/reflection/${e.id}`,
        at: e.completedAt ?? e.updatedAt,
        title,
        detail: topics,
        topics,
        kind: "open",
        kindLabel: COPY.filterWriting,
        draft: !e.completedAt,
        awaitingSummary: e.completedAt !== null && !topicsByEntry.has(e.id),
      };
    }),
    ...responses.map((r): Row => {
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
          decryptFailures += 1;
        }
      }

      return {
        id: r.id,
        href: tracker ? `/checkin/${r.id}` : `/framework/${r.id}`,
        at: r.completedAt ?? r.createdAt,
        // A questionnaire's name IS its title; there is no user-set one.
        title: q?.title ?? r.slug,
        detail,
        topics: [],
        kind: tracker ? "checkin" : "framework",
        kindLabel: q?.shortName ?? r.slug,
        draft: false,
        awaitingSummary: false,
      };
    }),
  ]
    .filter((r) => filter === "all" || r.kind === filter)
    .filter(
      (r) =>
        !topic ||
        r.topics.some((t) => t.toLowerCase() === topic.toLowerCase())
    )
    // Search runs over titles and topics — the two things already decrypted to
    // draw this list. Searching bodies would mean decrypting every entry on
    // every keystroke-shaped request, which is the excerpt problem wearing a
    // different hat. Full-text over content is a Cabinet 3 concern.
    .filter((r) => {
      if (!query) return true;
      const needle = query.toLowerCase();
      return (
        (r.title?.toLowerCase().includes(needle) ?? false) ||
        r.topics.some((t) => t.toLowerCase().includes(needle)) ||
        r.kindLabel.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) =>
      sort === "newest"
        ? b.at.getTime() - a.at.getTime()
        : a.at.getTime() - b.at.getTime()
    );

  if (decryptFailures > 0) {
    console.error(
      `Archive: ${decryptFailures} record(s) failed to decrypt for user ${userId}`
    );
  }

  // One row for the page, carrying the count. See the note at the top.
  const decrypted = topicsByEntry.size + responses.length;
  if (decrypted > 0) {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId,
      context: `archive_list_view (${topicsByEntry.size} summaries, ${responses.length} responses read)`,
    });
  }

  // Month headers, in the order the rows are already sorted into.
  const groups: { key: string; label: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const key = `${row.at.getFullYear()}-${row.at.getMonth()}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(row);
    else
      groups.push({
        key,
        label: row.at.toLocaleDateString(undefined, {
          month: "long",
          year:
            row.at.getFullYear() === new Date().getFullYear()
              ? undefined
              : "numeric",
        }),
        rows: [row],
      });
  }

  const total = entries.length + responses.length;
  const earliest = [...entries, ...responses]
    .map((r) => r.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const current: View = { filter, sort, topic, q: query };

  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 700 }}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-[14px]">
            <div>
              <Eyebrow>
                {COPY.records(total)}
                {earliest &&
                  COPY.since(
                    earliest.toLocaleDateString(undefined, { month: "long" })
                  )}
              </Eyebrow>
              <h1
                className="mt-[9px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "30px",
                  fontWeight: 380,
                  letterSpacing: "-0.02em",
                  color: "var(--rf-text)",
                }}
              >
                {COPY.headline}
              </h1>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Link
                    key={f.key}
                    href={hrefWith(current, { filter: f.key })}
                    aria-current={on ? "page" : undefined}
                    className="rounded-full transition-colors"
                    style={{
                      padding: "6px 13px",
                      fontSize: "12.5px",
                      color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                      background: on ? "var(--rf-text)" : "transparent",
                      boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    {f.label}
                  </Link>
                );
              })}

              <Link
                href={hrefWith(current, {
                  sort: sort === "newest" ? "oldest" : "newest",
                })}
                className="font-mono uppercase transition-colors"
                style={{
                  padding: "6px 4px",
                  fontSize: "9.5px",
                  letterSpacing: "0.14em",
                  color: "var(--rf-text-4)",
                }}
              >
                {sort === "newest" ? COPY.sortNewest : COPY.sortOldest}
              </Link>
            </nav>
          </div>

          {/* Search. A GET form, so a search is a URL: shareable, bookmarkable,
              survives a reload, and needs no client component. The other
              parameters ride along as hidden fields rather than being dropped
              when someone searches inside a filter. */}
          <form action="/reflections" method="get" className="mb-3 flex gap-2">
            {filter !== "all" && (
              <input type="hidden" name="filter" value={filter} />
            )}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            {topic && <input type="hidden" name="topic" value={topic} />}

            <label htmlFor="archive-search" className="sr-only">
              {COPY.searchLabel}
            </label>
            <input
              id="archive-search"
              name="q"
              type="search"
              defaultValue={query ?? ""}
              placeholder={COPY.searchPlaceholder}
              className="min-w-0 flex-1 rounded-full px-4 py-2 outline-none"
              style={{
                fontSize: "13px",
                color: "var(--rf-text)",
                background: "var(--rf-paper)",
                boxShadow: "inset 0 0 0 1px var(--rf-border)",
              }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-full transition-colors"
              style={{
                padding: "8px 15px",
                fontSize: "12.5px",
                color: "var(--rf-text-2)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              {COPY.searchSubmit}
            </button>
          </form>

          {(topic || query) && (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {topic && (
                <>
                  <span
                    className="rounded-full"
                    style={{
                      padding: "5px 12px",
                      fontSize: "12.5px",
                      color: "var(--rf-accent)",
                      background: "var(--rf-accent-soft)",
                    }}
                  >
                    {COPY.topicFilter(topic)}
                  </span>
                  <Link
                    href={hrefWith(current, { topic: null })}
                    className="font-mono uppercase"
                    style={{
                      fontSize: "9.5px",
                      letterSpacing: "0.14em",
                      color: "var(--rf-text-3)",
                    }}
                  >
                    {COPY.clearTopic}
                  </Link>
                </>
              )}
              {query && (
                <>
                  <span
                    className="rounded-full"
                    style={{
                      padding: "5px 12px",
                      fontSize: "12.5px",
                      color: "var(--rf-text-2)",
                      background: "var(--rf-surface)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    {COPY.searchingFor(query)}
                  </span>
                  <Link
                    href={hrefWith(current, { q: null })}
                    className="font-mono uppercase"
                    style={{
                      fontSize: "9.5px",
                      letterSpacing: "0.14em",
                      color: "var(--rf-text-3)",
                    }}
                  >
                    {COPY.searchClear}
                  </Link>
                </>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            <Sheet className="px-8 py-14 text-center">
              <p style={{ fontSize: "14px", lineHeight: 1.9, color: "var(--rf-text-3)" }}>
                {query
                  ? COPY.emptySearch
                  : topic
                    ? COPY.emptyTopic
                    : filter === "all"
                      ? COPY.emptyAll
                      : COPY.emptyFiltered}
                <br />
                <Link
                  href="/"
                  className="underline underline-offset-[3px]"
                  style={{ color: "var(--rf-text-2)", textDecorationColor: "var(--rf-border-strong)" }}
                >
                  {COPY.start}
                </Link>
              </p>
            </Sheet>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key}>
                  <div className="pb-[6px]">
                    <Eyebrow size={9.5}>{group.label}</Eyebrow>
                  </div>

                  <Sheet className="px-7 pb-5 pt-1">
                    {group.rows.map((r, i) => (
                      <div
                        key={`${r.kind}-${r.id}`}
                        className="py-[15px]"
                        style={{
                          borderTop: i === 0 ? "none" : "1px solid var(--rf-rule)",
                        }}
                      >
                        {/* Header: date and kind. The kind is stated here
                            rather than floated right, so the card reads
                            top-down at every width. */}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <Eyebrow size={9.5}>
                            {r.at.toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </Eyebrow>
                          <span
                            className="inline-flex w-fit items-center rounded-full font-mono uppercase"
                            style={{
                              padding: "3px 9px",
                              fontSize: "9.5px",
                              letterSpacing: "0.12em",
                              color:
                                r.kind === "framework"
                                  ? "var(--rf-accent)"
                                  : "var(--rf-text-3)",
                              background:
                                r.kind === "framework"
                                  ? "var(--rf-accent-soft)"
                                  : "transparent",
                              boxShadow:
                                r.kind === "framework"
                                  ? "none"
                                  : "inset 0 0 0 1px var(--rf-border)",
                            }}
                          >
                            {r.kindLabel}
                          </span>
                        </div>

                        <Link href={r.href} className="mt-[5px] block">
                          <p
                            className="truncate"
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "17.5px",
                              color:
                                r.title === null
                                  ? "var(--rf-text-3)"
                                  : r.kind === "open"
                                    ? "var(--rf-text)"
                                    : "var(--rf-text-2)",
                            }}
                          >
                            {r.title ?? COPY.untitled}
                          </p>
                        </Link>

                        {/* Subheader: what it was about. Topics link to the
                            topic filter; a check-in's values do not link. */}
                        {r.detail.length > 0 && (
                          <div className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-1">
                            {r.topics.length > 0
                              ? r.topics.map((t) => (
                                  <Link
                                    key={t}
                                    href={hrefWith(current, { topic: t })}
                                    className="rounded-full transition-colors"
                                    style={{
                                      padding: "2px 9px",
                                      fontSize: "11.5px",
                                      color: "var(--rf-text-2)",
                                      background: "var(--rf-surface)",
                                      boxShadow:
                                        "inset 0 0 0 1px var(--rf-border)",
                                    }}
                                  >
                                    {t}
                                  </Link>
                                ))
                              : (
                                <span
                                  style={{
                                    fontSize: "11.5px",
                                    color: "var(--rf-text-3)",
                                  }}
                                >
                                  {r.detail.join(" · ")}
                                </span>
                              )}
                          </div>
                        )}

                        {(r.draft || r.awaitingSummary) && (
                          <p
                            className="mt-[5px] font-mono uppercase"
                            style={{
                              fontSize: "9.5px",
                              letterSpacing: "0.14em",
                              color: "var(--rf-text-4)",
                            }}
                          >
                            {r.draft ? COPY.unfinished : COPY.summarising}
                          </p>
                        )}
                      </div>
                    ))}
                  </Sheet>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageBg>
  );
}
