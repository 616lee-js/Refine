import Link from "next/link";
import { Eyebrow } from "@/components/ui/sheet";
import { RecordCard, RecordCardList } from "@/components/ui/record-card";
import type { ArchiveRecord, CategoryOption, RecordKind } from "./records";

/**
 * The archive rail — every record as a card, with the filters that narrow it.
 *
 * ── Why the bar is split ──────────────────────────────────────────────────────
 * Three controls are in view: a date range you type, record type, and search.
 * Everything else sits behind a disclosure.
 *
 * The category picker is what forced this. It rendered every distinct category
 * as a chip, and categories are specific phrases today rather than buckets — so
 * the bar grew roughly one chip per entry and buried the list it exists to
 * narrow. A `<select>` absorbs any number of options where a chip row cannot,
 * which is the real defect; putting it behind a disclosure is the rest of it.
 * The split stays right once categories become broad.
 *
 * ── Active filters are always visible ─────────────────────────────────────────
 * Anything set from inside the disclosure still shows as a removable chip in
 * the bar. This is required by the disclosure, not decoration: a filter you
 * cannot see produces a short list with no visible cause, which reads as a bug.
 *
 * ── State lives in the URL ────────────────────────────────────────────────────
 * Every control is a link or a GET form, so a filtered view is shareable,
 * survives a reload, and needs no client component. Native `<details>` for the
 * disclosure, so keyboard and screen-reader behaviour come free.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  railLabel: "[COPY] Your records",
  heading: "[COPY] Records",
  count: (shown: number, total: number) =>
    shown < total ? `[COPY] ${shown} of ${total}` : `[COPY] ${total}`,

  clearAll: "[COPY] Clear all",
  activeLabel: "[COPY] Filtering by",
  remove: "[COPY] Remove filter",

  dateLabel: "[COPY] Dates",
  from: "[COPY] From",
  to: "[COPY] To",
  apply: "[COPY] Apply",

  typeLabel: "[COPY] Type",
  typeAll: "[COPY] All",
  typeWriting: "[COPY] Writing",
  typeCheckin: "[COPY] Check-ins",
  typeFramework: "[COPY] Framework",

  searchLabel: "[COPY] Search records",
  searchPlaceholder: "[COPY] Search",

  more: "[COPY] More filters",
  quickRanges: "[COPY] Quick ranges",
  range7d: "[COPY] Last 7 days",
  range30d: "[COPY] Last 30 days",
  rangeMonth: "[COPY] This month",
  rangeYear: "[COPY] This year",
  rangeAll: "[COPY] Any time",

  categoryLabel: "[COPY] Category",
  categoryAny: "[COPY] Any category",
  categoryNote: "[COPY] Most used first",

  chipDates: (from: string | null, to: string | null) =>
    from && to
      ? `[COPY] ${from} to ${to}`
      : from
        ? `[COPY] From ${from}`
        : `[COPY] Until ${to}`,
  chipRange: (label: string) => label,
  chipCategory: (c: string) => `[COPY] Category: ${c}`,
  chipSearch: (q: string) => `[COPY] Search: ${q}`,

  empty: "[COPY] Nothing here yet.",
  emptyFiltered: "[COPY] Nothing matches these filters.",
  start: "[COPY] Start something",

  unfinished: "[COPY] Unfinished",
  summarising: "[COPY] Summarising…",
} as const;

export type RailView = {
  kind: RecordKind | "all";
  range: string;
  from: string | null;
  to: string | null;
  category: string | null;
  q: string | null;
};

/** Preserves the other parameters when one of them changes. */
export function railHref(current: RailView, change: Partial<RailView>): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.kind !== "all") params.set("filter", next.kind);
  // Typed dates win over the preset, so a range value is only meaningful when
  // neither is set — see parseFilters in ./records.ts.
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (!next.from && !next.to && next.range !== "all") {
    params.set("range", next.range);
  }
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `/reflections?${qs}` : "/reflections";
}

const RANGES: { key: string; label: string }[] = [
  { key: "all", label: COPY.rangeAll },
  { key: "7d", label: COPY.range7d },
  { key: "30d", label: COPY.range30d },
  { key: "month", label: COPY.rangeMonth },
  { key: "year", label: COPY.rangeYear },
];

const TYPES: { key: RecordKind | "all"; label: string }[] = [
  { key: "all", label: COPY.typeAll },
  { key: "open", label: COPY.typeWriting },
  { key: "checkin", label: COPY.typeCheckin },
  { key: "framework", label: COPY.typeFramework },
];

function chip(on: boolean) {
  return {
    padding: "5px 11px",
    fontSize: "11.5px",
    borderRadius: 999,
    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
    background: on ? "var(--rf-text)" : "transparent",
    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
  };
}

const groupLabel: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--rf-text-3)",
};

const fieldStyle: React.CSSProperties = {
  fontSize: "11.5px",
  color: "var(--rf-text)",
  background: "var(--rf-paper)",
  boxShadow: "inset 0 0 0 1px var(--rf-border)",
};

/** Carries the filters a form does not itself edit. */
function HiddenExcept({
  view,
  omit,
}: {
  view: RailView;
  omit: (keyof RailView)[];
}) {
  const keep = (k: keyof RailView) => !omit.includes(k);
  return (
    <>
      {keep("kind") && view.kind !== "all" && (
        <input type="hidden" name="filter" value={view.kind} />
      )}
      {keep("from") && view.from && (
        <input type="hidden" name="from" value={view.from} />
      )}
      {keep("to") && view.to && <input type="hidden" name="to" value={view.to} />}
      {keep("range") &&
        !view.from &&
        !view.to &&
        view.range !== "all" && (
          <input type="hidden" name="range" value={view.range} />
        )}
      {keep("category") && view.category && (
        <input type="hidden" name="category" value={view.category} />
      )}
      {keep("q") && view.q && <input type="hidden" name="q" value={view.q} />}
    </>
  );
}

/** One active filter, with the link that removes it. */
function ActiveChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`${COPY.remove}: ${label}`}
      className="inline-flex items-center gap-[6px] rounded-full transition-colors"
      style={{
        padding: "4px 9px 4px 10px",
        fontSize: "11px",
        color: "var(--rf-text-2)",
        background: "var(--rf-accent-soft)",
      }}
    >
      {label}
      <svg
        width="9"
        height="9"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M2 2 L8 8 M8 2 L2 8" />
      </svg>
    </Link>
  );
}

export function RecordRail({
  records,
  categories,
  total,
  view,
  selectedId,
}: {
  records: ArchiveRecord[];
  /** Counted, most-used first — see loadRecords. */
  categories: CategoryOption[];
  /** How many matched before the rail cap. */
  total: number;
  view: RailView;
  /** The record open in the main view, if any. */
  selectedId?: string;
}) {
  const dated = Boolean(view.from || view.to);
  const ranged = !dated && view.range !== "all";
  const filtered =
    view.kind !== "all" || dated || ranged || view.category !== null || view.q !== null;

  const rangeLabel = RANGES.find((r) => r.key === view.range)?.label ?? "";

  return (
    <aside
      aria-label={COPY.railLabel}
      className="flex w-full shrink-0 flex-col gap-4 lg:w-[310px]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>{COPY.heading}</Eyebrow>
        <Eyebrow size={9}>{COPY.count(records.length, total)}</Eyebrow>
      </div>

      <div
        className="rounded-[4px] px-4 py-[14px]"
        style={{
          background: "var(--rf-surface)",
          boxShadow: "inset 0 0 0 1px var(--rf-border)",
        }}
      >
        {/* ── Always visible: dates, type, search ── */}
        <form action="/reflections" method="get">
          <HiddenExcept view={view} omit={["from", "to", "range", "q"]} />

          <span style={groupLabel}>{COPY.dateLabel}</span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1" style={{ minWidth: 104 }}>
              <span style={{ ...groupLabel, color: "var(--rf-text-4)" }}>
                {COPY.from}
              </span>
              <input
                type="date"
                name="from"
                defaultValue={view.from ?? ""}
                className="w-full rounded-[4px] px-2 py-[5px] outline-none"
                style={fieldStyle}
              />
            </label>
            <label className="flex-1" style={{ minWidth: 104 }}>
              <span style={{ ...groupLabel, color: "var(--rf-text-4)" }}>
                {COPY.to}
              </span>
              <input
                type="date"
                name="to"
                defaultValue={view.to ?? ""}
                className="w-full rounded-[4px] px-2 py-[5px] outline-none"
                style={fieldStyle}
              />
            </label>
          </div>

          <div className="mt-3">
            <label htmlFor="rail-search" style={groupLabel}>
              {COPY.searchLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="rail-search"
                name="q"
                type="search"
                defaultValue={view.q ?? ""}
                placeholder={COPY.searchPlaceholder}
                className="min-w-0 flex-1 rounded-full px-3 py-[6px] outline-none"
                style={fieldStyle}
              />
              <button
                type="submit"
                className="shrink-0 rounded-full transition-colors"
                style={{
                  padding: "6px 12px",
                  fontSize: "11.5px",
                  color: "var(--rf-text-2)",
                  boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                }}
              >
                {COPY.apply}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-3">
          <span style={groupLabel}>{COPY.typeLabel}</span>
          <div className="flex flex-wrap gap-[6px]">
            {TYPES.map((t) => (
              <Link
                key={t.key}
                href={railHref(view, { kind: t.key })}
                aria-current={view.kind === t.key ? "true" : undefined}
                className="transition-colors"
                style={chip(view.kind === t.key)}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Behind a disclosure: quick ranges, category ── */}
        <details className="mt-3">
          <summary
            className="cursor-pointer list-none py-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--rf-text-2)",
            }}
          >
            {COPY.more}
          </summary>

          <div className="mt-2">
            <span style={groupLabel}>{COPY.quickRanges}</span>
            <div className="flex flex-wrap gap-[6px]">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={railHref(view, {
                    range: r.key,
                    // A preset replaces typed dates rather than fighting them.
                    from: null,
                    to: null,
                  })}
                  aria-current={
                    !dated && view.range === r.key ? "true" : undefined
                  }
                  className="transition-colors"
                  style={chip(!dated && view.range === r.key)}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>

          {/* A select, not chips: it absorbs any number of options. Absent
              entirely when nothing has been categorised — an empty picker
              teaches people the feature is broken. */}
          {categories.length > 0 && (
            <form action="/reflections" method="get" className="mt-3">
              <HiddenExcept view={view} omit={["category"]} />
              <label htmlFor="rail-category" style={groupLabel}>
                {COPY.categoryLabel}{" "}
                <span style={{ color: "var(--rf-text-4)" }}>
                  {COPY.categoryNote}
                </span>
              </label>
              <div className="flex gap-2">
                <select
                  id="rail-category"
                  name="category"
                  defaultValue={view.category ?? ""}
                  className="min-w-0 flex-1 rounded-[4px] px-2 py-[5px] outline-none"
                  style={fieldStyle}
                >
                  <option value="">{COPY.categoryAny}</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value} ({c.count})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="shrink-0 rounded-full transition-colors"
                  style={{
                    padding: "5px 12px",
                    fontSize: "11.5px",
                    color: "var(--rf-text-2)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                  }}
                >
                  {COPY.apply}
                </button>
              </div>
            </form>
          )}
        </details>

        {/* ── What is actually on, including anything set above ── */}
        {filtered && (
          <div
            className="mt-3 pt-3"
            style={{ borderTop: "1px solid var(--rf-border)" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...groupLabel, marginBottom: 0 }}>
                {COPY.activeLabel}
              </span>
              <Link
                href="/reflections"
                className="font-mono uppercase transition-colors"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.14em",
                  color: "var(--rf-accent)",
                }}
              >
                {COPY.clearAll}
              </Link>
            </div>

            <div className="mt-2 flex flex-wrap gap-[6px]">
              {dated && (
                <ActiveChip
                  label={COPY.chipDates(view.from, view.to)}
                  href={railHref(view, { from: null, to: null })}
                />
              )}
              {ranged && (
                <ActiveChip
                  label={COPY.chipRange(rangeLabel)}
                  href={railHref(view, { range: "all" })}
                />
              )}
              {view.kind !== "all" && (
                <ActiveChip
                  label={
                    TYPES.find((t) => t.key === view.kind)?.label ?? view.kind
                  }
                  href={railHref(view, { kind: "all" })}
                />
              )}
              {view.category && (
                <ActiveChip
                  label={COPY.chipCategory(view.category)}
                  href={railHref(view, { category: null })}
                />
              )}
              {view.q && (
                <ActiveChip
                  label={COPY.chipSearch(view.q)}
                  href={railHref(view, { q: null })}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <p style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}>
          {filtered ? COPY.emptyFiltered : COPY.empty}{" "}
          {!filtered && (
            <Link
              href="/"
              className="underline underline-offset-[3px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {COPY.start}
            </Link>
          )}
        </p>
      ) : (
        <RecordCardList>
          {records.map((r) => (
            <RecordCard
              key={`${r.kind}-${r.id}`}
              href={r.href}
              kindLabel={r.kindLabel}
              at={r.at}
              detail={r.detail}
              accent={r.kind === "framework"}
              selected={r.id === selectedId}
              statusLabel={
                r.draft
                  ? COPY.unfinished
                  : r.awaitingSummary
                    ? COPY.summarising
                    : undefined
              }
            />
          ))}
        </RecordCardList>
      )}
    </aside>
  );
}
