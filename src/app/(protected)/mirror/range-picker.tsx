"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Eyebrow } from "@/components/ui/sheet";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  DEFAULT_RANGE,
  dateInputValue,
  isRangeKey,
  type RangeKey,
} from "@/lib/trends/range";

/**
 * How much of the record the charts show.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Trends looked back a fixed 90 days with no way to change it. That hid the long
 * view entirely, and made a quarterly instrument permanently uncharted — at one
 * reading per 90 days it could never reach the five a line needs.
 *
 * ── It writes to the URL, not to state ───────────────────────────────────────
 * The filtering happens on the server, where the responses are already decrypted,
 * so the selection has to reach the server. Keeping it in the URL also means a
 * view survives a reload and can be linked. Same reason the Mirror tab is a
 * parameter.
 *
 * ── Collapsed by default ─────────────────────────────────────────────────────
 * The product owner asked for it above the charts and out of the way. The current
 * selection shows on the closed row, so it never needs opening to know what you
 * are looking at.
 */

// COPY REVIEW: placeholders.
const COPY = {
  title: "[COPY] Showing",
  "1m": "[COPY] Last month",
  ytd: "[COPY] This year",
  total: "[COPY] Everything",
  custom: "[COPY] Pick dates",
  from: "[COPY] From",
  to: "[COPY] To",
  apply: "[COPY] Apply",
  customNote: "[COPY] Leave either end blank for no limit.",
} as const;

const PRESETS: RangeKey[] = ["1m", "ytd", "total"];

export function RangePicker() {
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("range");
  const active: RangeKey = isRangeKey(raw) ? raw : DEFAULT_RANGE;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  /** Keeps the tab, replaces the range. */
  function go(next: { range: RangeKey; from?: string; to?: string }) {
    const q = new URLSearchParams();
    const tab = params.get("tab");
    if (tab) q.set("tab", tab);
    q.set("range", next.range);
    if (next.range === "custom") {
      if (next.from) q.set("from", next.from);
      if (next.to) q.set("to", next.to);
    }
    router.push(`/mirror?${q.toString()}`, { scroll: false });
  }

  const label = active === "custom" && (from || to)
    ? `${from || "…"} → ${to || "…"}`
    : COPY[active];

  return (
    <CollapsibleSection
      title={COPY.title}
      defaultOpen={false}
      right={
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-3)",
          }}
        >
          {label}
        </span>
      }
    >
      <div className="flex flex-wrap items-end gap-x-[6px] gap-y-3 pb-1">
        {PRESETS.map((key) => {
          const on = active === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => go({ range: key })}
              className="rounded-full transition-colors"
              style={{
                padding: "5px 12px",
                fontSize: "11.5px",
                background: on ? "var(--rf-text)" : "transparent",
                color: on ? "var(--rf-paper)" : "var(--rf-text-2)",
                boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              {COPY[key]}
            </button>
          );
        })}

        {/* Submits through the router rather than as a plain GET form, which
            would reload the whole page and throw away the charts below it. */}
        <form
          className="flex flex-wrap items-end gap-x-2 gap-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const str = (k: string) => {
              const v = f.get(k);
              return typeof v === "string" && v ? v : undefined;
            };
            go({ range: "custom", from: str("from"), to: str("to") });
          }}
        >
          <label className="flex items-center gap-[6px]">
            <Eyebrow size={9}>{COPY.from}</Eyebrow>
            <input
              type="date"
              name="from"
              defaultValue={from}
              max={dateInputValue(new Date())}
              className="rf-input"
              style={{ fontSize: "11px" }}
            />
          </label>
          <label className="flex items-center gap-[6px]">
            <Eyebrow size={9}>{COPY.to}</Eyebrow>
            <input
              type="date"
              name="to"
              defaultValue={to}
              max={dateInputValue(new Date())}
              className="rf-input"
              style={{ fontSize: "11px" }}
            />
          </label>
          <button
            type="submit"
            className="rounded-full transition-colors"
            style={{
              padding: "5px 12px",
              fontSize: "11.5px",
              background: active === "custom" ? "var(--rf-text)" : "transparent",
              color:
                active === "custom" ? "var(--rf-paper)" : "var(--rf-text-2)",
              boxShadow:
                active === "custom"
                  ? "none"
                  : "inset 0 0 0 1px var(--rf-border-strong)",
            }}
          >
            {COPY.apply}
          </button>
        </form>
      </div>

      <p style={{ fontSize: "11px", color: "var(--rf-text-4)" }}>
        {COPY.customNote}
      </p>
    </CollapsibleSection>
  );
}
