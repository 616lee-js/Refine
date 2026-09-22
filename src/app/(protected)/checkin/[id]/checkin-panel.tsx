"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eyebrow } from "@/components/ui/sheet";
import type { Answers, TrackerQuestionnaire } from "@/lib/questionnaires";

/**
 * The check-in side panel: what to start, and what has been logged.
 *
 * ── Order ─────────────────────────────────────────────────────────────────────
 * Entry options first, then recent check-ins. The panel answers "what can I do
 * here" before "what have I done", because the first is why someone opened the
 * screen and the second is context for it.
 *
 * ── Card summaries, not a chart ───────────────────────────────────────────────
 * Each card states the day's values plainly. No averages, no streak, no colour
 * ramp implying good and bad days — the panel is a record, and Trends in Mirror
 * is where movement over time is read. Nothing here congratulates or warns.
 *
 * ── Below lg ──────────────────────────────────────────────────────────────────
 * The panel moves below the form rather than disappearing. Design-system rule:
 * never hide content at a breakpoint, move it.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  start: "[COPY] Start",
  newCheckin: "[COPY] New check-in",
  opening: "[COPY] Opening…",
  startError: "[COPY] Couldn't start a new check-in",
  recent: "[COPY] Recent check-ins",
  filterAll: "[COPY] All",
  filterWeek: "[COPY] This week",
  filterMonth: "[COPY] This month",
  empty: "[COPY] Nothing logged yet",
  emptyFiltered: "[COPY] Nothing in this range",
  current: "[COPY] Open",
} as const;

export type CheckinSummary = {
  id: string;
  completedAt: string;
  answers: Answers;
};

type Filter = "all" | "week" | "month";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: COPY.filterAll },
  { key: "week", label: COPY.filterWeek },
  { key: "month", label: COPY.filterMonth },
];

function withinFilter(at: Date, filter: Filter, now: Date): boolean {
  if (filter === "all") return true;
  if (filter === "month") {
    return (
      at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()
    );
  }
  // Week: the last seven days including today, not a calendar week — "this
  // week" on a Monday would otherwise show one day.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 6);
  return at.getTime() >= start.getTime();
}

/**
 * One line of values for a card, built from the instrument's own fields so a
 * new field appears here without a change to this component.
 *
 * Toggles collapse to the labels that were switched on: "Medication · Outside"
 * says what happened, where "2 of 5" would read as a score.
 */
function summarise(q: TrackerQuestionnaire, answers: Answers): string[] {
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

export function CheckinPanel({
  questionnaire,
  currentId,
  recent,
}: {
  questionnaire: TrackerQuestionnaire;
  currentId: string;
  recent: CheckinSummary[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const shown = recent.filter((r) =>
    withinFilter(new Date(r.completedAt), filter, now)
  );

  async function startNew() {
    setStarting(true);
    setError(null);
    try {
      // POST resumes today's unfinished response where one exists rather than
      // creating a second — see src/app/api/questionnaires/route.ts.
      const res = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: questionnaire.slug }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { responseId } = (await res.json()) as { responseId: string };
      router.push(`/checkin/${responseId}?edit=1`);
    } catch {
      setError(COPY.startError);
      setStarting(false);
    }
  }

  const chip = (on: boolean) => ({
    padding: "5px 11px",
    fontSize: "12px",
    borderRadius: 999,
    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
    background: on ? "var(--rf-text)" : "transparent",
    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
  });

  return (
    <aside
      aria-label={COPY.recent}
      className="flex w-full shrink-0 flex-col gap-6 lg:w-[290px]"
    >
      <div>
        <Eyebrow>{COPY.start}</Eyebrow>
        <button
          type="button"
          onClick={startNew}
          disabled={starting}
          className="mt-[10px] w-full rounded-[4px] transition-colors disabled:opacity-40"
          style={{
            padding: "11px 14px",
            fontSize: "13px",
            fontWeight: 500,
            textAlign: "left",
            color: "var(--rf-text-2)",
            background: "var(--rf-surface)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        >
          {starting ? COPY.opening : COPY.newCheckin}
        </button>
        {error && (
          <p
            aria-live="polite"
            className="mt-2"
            style={{ fontSize: "11.5px", color: "var(--color-error)" }}
          >
            {error}
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>{COPY.recent}</Eyebrow>
        </div>

        <div className="mt-[10px] flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className="transition-colors"
              style={chip(filter === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p
            className="mt-4"
            style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}
          >
            {recent.length === 0 ? COPY.empty : COPY.emptyFiltered}
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {shown.map((r) => {
              const at = new Date(r.completedAt);
              const current = r.id === currentId;
              const values = summarise(questionnaire, r.answers);
              return (
                <li key={r.id}>
                  <Link
                    href={`/checkin/${r.id}`}
                    aria-current={current ? "page" : undefined}
                    className="block rounded-[4px] transition-colors"
                    style={{
                      padding: "10px 12px",
                      background: current
                        ? "var(--rf-accent-soft)"
                        : "var(--rf-paper)",
                      boxShadow: current
                        ? "inset 0 0 0 1px var(--rf-accent-soft)"
                        : "inset 0 0 0 1px var(--rf-paper-edge)",
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "15px",
                          color: "var(--rf-text)",
                        }}
                      >
                        {at.toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      {current && (
                        <Eyebrow accent size={9}>
                          {COPY.current}
                        </Eyebrow>
                      )}
                    </div>
                    {values.length > 0 && (
                      <p
                        className="mt-[3px]"
                        style={{
                          fontSize: "11.5px",
                          lineHeight: 1.5,
                          color: "var(--rf-text-3)",
                        }}
                      >
                        {values.join(" · ")}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
