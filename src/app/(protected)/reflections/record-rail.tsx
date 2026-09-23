import Link from "next/link";
import { Eyebrow } from "@/components/ui/sheet";
import { RecordCard, RecordCardList } from "@/components/ui/record-card";
import type { ArchiveRecord, RecordKind } from "./records";

/**
 * The archive rail — every record as a card, with the filters that narrow it.
 *
 * ── Preset controls, not a keyword box ────────────────────────────────────────
 * The filters are things you pick: a date range, a category that actually
 * exists in your records, a record type. Text search survives but is demoted
 * beside them, because typing a word is a poor way to find a batch of records
 * and a good way to find one you already remember.
 *
 * ── State lives in the URL ────────────────────────────────────────────────────
 * Every control is a link or a GET form, so a filtered view is shareable,
 * survives a reload, and needs no client component. `Clear` sits inside the bar
 * with the controls it clears.
 *
 * ── It renders beside the record, not above it ────────────────────────────────
 * The rail is the left column at `lg` and up, with the record in the main view.
 * Below `lg` it stacks above the record rather than disappearing — the
 * design-system rule is move, never hide.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  railLabel: "[COPY] Your records",
  heading: "[COPY] Records",
  count: (shown: number, total: number) =>
    shown < total ? `[COPY] ${shown} of ${total}` : `[COPY] ${total}`,

  filters: "[COPY] Filter",
  clear: "[COPY] Clear filters",

  rangeLabel: "[COPY] When",
  rangeAll: "[COPY] Any time",
  range7d: "[COPY] Last 7 days",
  range30d: "[COPY] Last 30 days",
  rangeMonth: "[COPY] This month",
  rangeYear: "[COPY] This year",
  rangeCustom: "[COPY] Custom range",
  customFrom: "[COPY] From",
  customTo: "[COPY] To",
  customApply: "[COPY] Apply",

  typeLabel: "[COPY] Type",
  typeAll: "[COPY] All",
  typeWriting: "[COPY] Writing",
  typeCheckin: "[COPY] Check-ins",
  typeFramework: "[COPY] Framework",

  categoryLabel: "[COPY] Category",
  categoryAny: "[COPY] Any category",

  searchLabel: "[COPY] Search records",
  searchPlaceholder: "[COPY] Search titles and categories",

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
  if (next.range !== "all") params.set("range", next.range);
  if (next.range === "custom") {
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
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

const groupLabel = { marginBottom: 6, display: "block" } as const;

export function RecordRail({
  records,
  categories,
  total,
  view,
  selectedId,
}: {
  records: ArchiveRecord[];
  /** Every category in play, for the picker. */
  categories: string[];
  /** How many matched before the rail cap. */
  total: number;
  view: RailView;
  /** The record open in the main view, if any. */
  selectedId?: string;
}) {
  const filtered =
    view.kind !== "all" ||
    view.range !== "all" ||
    view.category !== null ||
    view.q !== null;

  return (
    <aside
      aria-label={COPY.railLabel}
      className="flex w-full shrink-0 flex-col gap-4 lg:w-[310px]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>{COPY.heading}</Eyebrow>
        <Eyebrow size={9}>{COPY.count(records.length, total)}</Eyebrow>
      </div>

      {/* The filter bar. Clear lives here, with what it clears. */}
      <div
        className="rounded-[4px] px-4 py-[14px]"
        style={{
          background: "var(--rf-surface)",
          boxShadow: "inset 0 0 0 1px var(--rf-border)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow size={9}>{COPY.filters}</Eyebrow>
          {filtered && (
            <Link
              href="/reflections"
              className="font-mono uppercase transition-colors"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                color: "var(--rf-accent)",
              }}
            >
              {COPY.clear}
            </Link>
          )}
        </div>

        <div className="mt-3">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-3)",
              ...groupLabel,
            }}
          >
            {COPY.rangeLabel}
          </span>
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={railHref(view, { range: r.key, from: null, to: null })}
                aria-current={view.range === r.key ? "true" : undefined}
                className="transition-colors"
                style={chip(view.range === r.key)}
              >
                {r.label}
              </Link>
            ))}
          </div>

          {/* Custom range. A GET form so the dates become the URL like every
              other control, rather than needing client state. */}
          <form action="/reflections" method="get" className="mt-[10px]">
            <input type="hidden" name="range" value="custom" />
            {view.kind !== "all" && (
              <input type="hidden" name="filter" value={view.kind} />
            )}
            {view.category && (
              <input type="hidden" name="category" value={view.category} />
            )}
            {view.q && <input type="hidden" name="q" value={view.q} />}

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1" style={{ minWidth: 110 }}>
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-4)",
                    ...groupLabel,
                  }}
                >
                  {COPY.customFrom}
                </span>
                <input
                  type="date"
                  name="from"
                  defaultValue={view.range === "custom" ? (view.from ?? "") : ""}
                  className="w-full rounded-[4px] px-2 py-[5px] outline-none"
                  style={{
                    fontSize: "11.5px",
                    color: "var(--rf-text)",
                    background: "var(--rf-paper)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border)",
                  }}
                />
              </label>
              <label className="flex-1" style={{ minWidth: 110 }}>
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-4)",
                    ...groupLabel,
                  }}
                >
                  {COPY.customTo}
                </span>
                <input
                  type="date"
                  name="to"
                  defaultValue={view.range === "custom" ? (view.to ?? "") : ""}
                  className="w-full rounded-[4px] px-2 py-[5px] outline-none"
                  style={{
                    fontSize: "11.5px",
                    color: "var(--rf-text)",
                    background: "var(--rf-paper)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border)",
                  }}
                />
              </label>
              <button
                type="submit"
                className="rounded-full transition-colors"
                style={{
                  padding: "6px 12px",
                  fontSize: "11.5px",
                  color: "var(--rf-text-2)",
                  boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                }}
              >
                {COPY.customApply}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-3)",
              ...groupLabel,
            }}
          >
            {COPY.typeLabel}
          </span>
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
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

        {/* Category: chosen from what exists, never typed. Absent entirely when
            nothing has been categorised yet — an empty picker teaches people the
            feature is broken. */}
        {categories.length > 0 && (
          <div className="mt-4">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-3)",
                ...groupLabel,
              }}
            >
              {COPY.categoryLabel}
            </span>
            <div className="mt-[6px] flex flex-wrap gap-[6px]">
              <Link
                href={railHref(view, { category: null })}
                aria-current={view.category === null ? "true" : undefined}
                className="transition-colors"
                style={chip(view.category === null)}
              >
                {COPY.categoryAny}
              </Link>
              {categories.map((c) => (
                <Link
                  key={c}
                  href={railHref(view, { category: c })}
                  aria-current={view.category === c ? "true" : undefined}
                  className="transition-colors"
                  style={chip(view.category === c)}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Secondary to the presets above, deliberately. */}
        <form action="/reflections" method="get" className="mt-4 flex gap-2">
          {view.kind !== "all" && (
            <input type="hidden" name="filter" value={view.kind} />
          )}
          {view.range !== "all" && (
            <input type="hidden" name="range" value={view.range} />
          )}
          {view.range === "custom" && view.from && (
            <input type="hidden" name="from" value={view.from} />
          )}
          {view.range === "custom" && view.to && (
            <input type="hidden" name="to" value={view.to} />
          )}
          {view.category && (
            <input type="hidden" name="category" value={view.category} />
          )}
          <label htmlFor="rail-search" className="sr-only">
            {COPY.searchLabel}
          </label>
          <input
            id="rail-search"
            name="q"
            type="search"
            defaultValue={view.q ?? ""}
            placeholder={COPY.searchPlaceholder}
            className="min-w-0 flex-1 rounded-full px-3 py-[6px] outline-none"
            style={{
              fontSize: "11.5px",
              color: "var(--rf-text)",
              background: "var(--rf-paper)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          />
        </form>
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
