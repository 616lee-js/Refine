"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecordCard, RecordCardList } from "@/components/ui/record-card";
import type { ArchiveRecord, CategoryOption, RecordKind } from "./records";

/**
 * The archive's left column: how you find a record, and the records themselves.
 *
 * ── One panel, not stacked parts ──────────────────────────────────────────────
 * The whole column is a single bordered panel on the secondary paper tone, with
 * the search controls above a divider and the record cards below it. The cards
 * keep the brighter paper, so they still read as separate objects sitting
 * inside the panel rather than dissolving into a list.
 *
 * ── The controls are compact on purpose ───────────────────────────────────────
 * This block sat about 200px tall, which pushed the first record below the fold
 * on shorter screens. The headings above each control were most of that, so
 * they are gone visually and kept as screen-reader-only labels — the controls
 * are self-evident by shape, an invisible label is not.
 *
 * The search box and its submit button share one border, so the box runs the
 * panel's full width instead of stopping short of a separate button.
 *
 * ── Why the rest is behind an expandable section ──────────────────────────────
 * The category picker forced the split. It rendered every distinct category as
 * its own small button, and categories are specific phrases today rather than
 * broad groupings — so the block grew roughly one button per entry and buried
 * the list it exists to narrow. A dropdown absorbs any number of options where
 * a row of buttons cannot; that is the real fix, and collapsing it is the rest.
 * The split stays right once categories become broad.
 *
 * ── Active filters are always visible ─────────────────────────────────────────
 * Anything set inside the collapsed section still shows as a removable marker
 * up top. This is required by collapsing it, not decoration: a filter you
 * cannot see produces a short list with no visible cause, which reads as a bug.
 *
 * ── It lives in the layout, so it survives navigation ─────────────────────────
 * This is the whole point of the file sitting where it does. Rendered per page,
 * every click on a record re-ran its queries, re-decrypted fifty records and
 * flashed the placeholder back in — which reads as the page reloading rather
 * than the record opening beside a list that stayed put.
 *
 * In `layout.tsx` React keeps this subtree mounted across navigation to any
 * child route, so it renders once and stays. That is why it is a client
 * component: a layout is not given the URL's search parameters, so the filters
 * have to be read here, with `useSearchParams`.
 *
 * ── State still lives in the URL ──────────────────────────────────────────────
 * A filtered view stays shareable and survives a reload. What changed is how it
 * gets there: the filter controls were plain GET forms, which submit natively
 * and reload the whole browser page. They now push through the router, and the
 * list refetches its own data rather than the page being rebuilt around it.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  railLabel: "[COPY] Search your records",
  heading: "[COPY] Search",
  // `capped` means the list was cut short by the row limit rather than by the
  // filters, so the number is a floor and says so rather than claiming a total.
  count: (shown: number, total: number, capped: boolean) =>
    capped
      ? `[COPY] ${shown}+`
      : shown < total
        ? `[COPY] ${shown} of ${total}`
        : `[COPY] ${total}`,

  clearAll: "[COPY] Clear all",
  activeLabel: "[COPY] Filtering by",
  remove: "[COPY] Remove filter",

  // Kept beside each box. The group heading above them is gone.
  from: "[COPY] From",
  to: "[COPY] To",
  apply: "[COPY] Apply",

  // Heading dropped; kept for screen readers via sr-only.
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

/** Small rounded buttons. Sized down so four fit on one line at rail width. */
function chip(on: boolean) {
  return {
    padding: "4px 9px",
    fontSize: "10.5px",
    borderRadius: 999,
    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
    background: on ? "var(--rf-text)" : "transparent",
    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
  };
}

/** Used only where a label is still shown — "From", "To", the section name. */
const groupLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--rf-text-3)",
};

/** The same, on its own line — inside the expandable section. */
const blockLabel: React.CSSProperties = {
  ...groupLabel,
  display: "block",
  marginBottom: 6,
};

const fieldStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--rf-text)",
  background: "var(--rf-paper)",
  boxShadow: "inset 0 0 0 1px var(--rf-border)",
};

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

/** The record open in the main view, taken from the path rather than a prop. */
function selectedIdFrom(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  // /reflections/<id> · /reflections/checkin/<id> · /reflections/framework/<id>
  if (parts[0] !== "reflections" || parts.length < 2) return undefined;
  return parts[parts.length - 1];
}

export function RecordRail({
  initial,
}: {
  /**
   * Server-rendered on first load so the list is present immediately. Fetched
   * with no filters, because the layout that renders this cannot see them —
   * arriving on a filtered URL refetches once on mount.
   */
  initial: {
    records: ArchiveRecord[];
    categories: CategoryOption[];
    total: number;
    capped: boolean;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = selectedIdFrom(pathname);

  const view: RailView = {
    kind: (() => {
      const k = params.get("filter");
      return k === "open" || k === "framework" || k === "checkin" ? k : "all";
    })(),
    range: params.get("range") ?? "all",
    from: params.get("from"),
    to: params.get("to"),
    category: params.get("category"),
    q: params.get("q"),
  };

  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  /*
   * Refetch when the filters change.
   *
   * Keyed on the query string so navigating between records — which keeps the
   * filters identical — does not refetch. Only a filter actually changing does.
   */
  const query = params.toString();
  const lastQuery = useRef<string | null>(null);

  useEffect(() => {
    // First render already has server-rendered data for the unfiltered case.
    if (lastQuery.current === null && query === "") {
      lastQuery.current = query;
      return;
    }
    if (lastQuery.current === query) return;
    lastQuery.current = query;

    let cancelled = false;
    setLoading(true);
    fetch(`/api/records?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((next) => {
        // A slower earlier request must not overwrite a newer result.
        if (!cancelled) setData(next);
      })
      .catch(() => {
        // Leaving the previous list up is better than emptying it: the filters
        // are visible above, so a stale list is legible where a blank one is
        // just confusing.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const { records, categories, total, capped } = data;

  /** Applies a filter change without a full page navigation. */
  function apply(next: Partial<RailView>) {
    router.push(railHref(view, next), { scroll: false });
  }

  const dated = Boolean(view.from || view.to);
  const ranged = !dated && view.range !== "all";
  const filtered =
    view.kind !== "all" || dated || ranged || view.category !== null || view.q !== null;

  const rangeLabel = RANGES.find((r) => r.key === view.range)?.label ?? "";

  return (
    <aside
      aria-label={COPY.railLabel}
      className="w-full shrink-0 rounded-[4px] p-3 lg:w-[340px]"
      style={{
        background: "var(--rf-surface)",
        boxShadow: "inset 0 0 0 1px var(--rf-border)",
      }}
    >
      <div className="mb-2">
        <span style={groupLabel}>{COPY.heading}</span>
      </div>

      <div>
        {/* ── Always visible: dates, search, type ──
            No headings above these. The controls say what they are, and the
            labels survive for screen readers below. */}
        {/* Submits through the router. As a plain GET form this reloaded the
            whole browser page, which threw away the list beside it. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const str = (k: string) => {
              const v = f.get(k);
              return typeof v === "string" && v.trim() ? v.trim() : null;
            };
            apply({ from: str("from"), to: str("to"), q: str("q") });
          }}
        >

          {/* Labels sit beside the boxes rather than above, which is a line
              saved. Allowed to wrap: browsers give a native date box a minimum
              width of its own, and two of them plus labels is close to it at
              this column width. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-[6px]">
            <label className="flex flex-1 items-center gap-[6px]" style={{ minWidth: 118 }}>
              <span style={{ ...groupLabel, color: "var(--rf-text-4)" }}>
                {COPY.from}
              </span>
              <input
                type="date"
                name="from"
                defaultValue={view.from ?? ""}
                className="min-w-0 flex-1 rounded-[4px] px-[6px] py-[4px] outline-none"
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-1 items-center gap-[6px]" style={{ minWidth: 118 }}>
              <span style={{ ...groupLabel, color: "var(--rf-text-4)" }}>
                {COPY.to}
              </span>
              <input
                type="date"
                name="to"
                defaultValue={view.to ?? ""}
                className="min-w-0 flex-1 rounded-[4px] px-[6px] py-[4px] outline-none"
                style={fieldStyle}
              />
            </label>
          </div>

          {/* Input and submit share one border, so the box runs the full width
              of the panel instead of stopping short of a separate button.
              Enter submits too — the button is a visible way to do the same
              thing, not the only one. */}
          <div
            className="mt-2 flex items-center rounded-full pr-[3px]"
            style={{
              background: "var(--rf-paper)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          >
            <label htmlFor="rail-search" className="sr-only">
              {COPY.searchLabel}
            </label>
            <input
              id="rail-search"
              name="q"
              type="search"
              defaultValue={view.q ?? ""}
              placeholder={COPY.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent px-3 py-[6px] outline-none"
              style={{ fontSize: "11px", color: "var(--rf-text)" }}
            />
            <button
              type="submit"
              aria-label={COPY.apply}
              className="grid shrink-0 place-items-center rounded-full transition-colors"
              style={{
                width: 22,
                height: 22,
                color: "var(--rf-text-2)",
                background: "var(--rf-surface)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 6 H9 M6 3 L9 6 L6 9" />
              </svg>
            </button>
          </div>
        </form>

        <div className="mt-2">
          <span className="sr-only">{COPY.typeLabel}</span>
          <div className="flex flex-wrap gap-[5px]">
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

        {/* ── Behind an expandable section: quick ranges, category ── */}
        <details className="group mt-2">
          <summary
            className="flex cursor-pointer list-none items-center gap-[5px] py-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--rf-text-2)",
            }}
          >
            {/* Turns when the section opens, so it reads as something that
                opens rather than as a label. The browser's own open state
                drives it — no JavaScript. */}
            <svg
              width="8"
              height="8"
              viewBox="0 0 10 10"
              fill="currentColor"
              className="transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M3 1 L8 5 L3 9 Z" />
            </svg>
            {COPY.more}
          </summary>

          <div className="mt-2">
            <span style={blockLabel}>{COPY.quickRanges}</span>
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
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget).get("category");
                apply({
                  category: typeof v === "string" && v ? v : null,
                });
              }}
            >
              <label htmlFor="rail-category" style={blockLabel}>
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
              <span style={groupLabel}>
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

      {/* The divider separates finding records from the records themselves,
          and carries the count that used to sit under a "Records" heading. */}
      <div
        className="mt-3 flex items-baseline justify-between gap-3 pt-3"
        style={{ borderTop: "1px solid var(--rf-border)" }}
      >
        <span style={groupLabel}>{COPY.count(records.length, total, capped)}</span>
      </div>

      {records.length === 0 ? (
        <p className="mt-2" style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}>
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
        /* Dimmed rather than replaced while refiltering. Swapping in a
           placeholder would throw away a list that is still mostly correct,
           and the flicker is worse than the wait. */
        <RecordCardList
          className="mt-2 transition-opacity"
          style={{ opacity: loading ? 0.45 : 1 }}
        >
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
