import Link from "next/link";
import { Eyebrow } from "@/components/ui/sheet";

/**
 * A month of the record, at a glance.
 *
 * ── What replaced what ────────────────────────────────────────────────────────
 * Four rows of the most recent records, which the product owner found unhelpful:
 * the four most recent things are mostly the four things you already remember
 * doing. A month shows shape instead — where the writing clusters, where it stops.
 *
 * ── It decrypts nothing ───────────────────────────────────────────────────────
 * The old list decrypted a summary per row to show its categories. This needs only
 * a date and a kind per record, so no content is read and no `content_access_log`
 * row is written — which matters because this is the most-visited screen in the
 * product and the rule everywhere else is that a list of records is capped and logs
 * one row carrying a count. A calendar that decrypted a month to draw thirty
 * squares would be the worst version of that rule.
 *
 * ── Nothing here is a score ───────────────────────────────────────────────────
 * Marks state that something was recorded. No counts per day, no colour ramp
 * implying a good day and a bad day, no streak, no "you missed Tuesday". An empty
 * day is empty and says nothing about it. Same rule the check-in and the record
 * cards follow.
 *
 * ── Days with records are links into the archive ──────────────────────────────
 * To `/reflections?from=…&to=…`, which already filters by date range. The calendar
 * answers "when", the archive answers "what" — so this needed no new query surface
 * and cannot drift from the filtering it hands off to.
 */

// COPY REVIEW: placeholders.
const COPY = {
  heading: "[COPY] Your month",
  seeEverything: "[COPY] See everything →",
  previous: "[COPY] ← Earlier",
  next: "[COPY] Later →",
  empty: "[COPY] Nothing recorded this month.",
  legendWriting: "[COPY] Writing",
  legendCheckin: "[COPY] Check-in",
  legendFramework: "[COPY] Framework",
  dayLabel: (date: string, kinds: string) => `${date} — ${kinds}`,
  today: "[COPY] Today",
} as const;

export type DayKind = "writing" | "checkin" | "framework";

export type CalendarDay = {
  /** `YYYY-MM-DD`, built on the server. Also the archive filter value. */
  date: string;
  dayOfMonth: number;
  kinds: DayKind[];
  isToday: boolean;
  /** Future days in the current month: drawn, but never marked or linked. */
  isFuture: boolean;
};

export type CalendarMonth = {
  /** `YYYY-MM`, for the previous/next links. */
  key: string;
  label: string;
  previousKey: string;
  /** Null when the month shown is the current one — there is nothing ahead. */
  nextKey: string | null;
  /** Leading blanks so the 1st lands under the right weekday. */
  leadingBlanks: number;
  days: CalendarDay[];
  /** Whether anything at all was recorded, for the empty line. */
  anyRecords: boolean;
};

const KIND_COLOUR: Record<DayKind, string> = {
  writing: "var(--rf-text-2)",
  checkin: "var(--rf-accent)",
  framework: "var(--rf-accent-2)",
};

const KIND_LABEL: Record<DayKind, string> = {
  writing: COPY.legendWriting,
  checkin: COPY.legendCheckin,
  framework: COPY.legendFramework,
};

/** Monday first. Single letters, so seven fit at any width. */
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function Dot({ kind }: { kind: DayKind }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 5,
        height: 5,
        borderRadius: 999,
        background: KIND_COLOUR[kind],
      }}
    />
  );
}

export function HomeCalendar({ month }: { month: CalendarMonth }) {
  return (
    <section className="mt-[34px]">
      <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <Eyebrow>{COPY.heading}</Eyebrow>
        <div className="flex items-center gap-4">
          <Link
            href={`/?month=${month.previousKey}`}
            className="font-mono uppercase transition-colors"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-4)",
            }}
          >
            {COPY.previous}
          </Link>
          {month.nextKey && (
            <Link
              href={`/?month=${month.nextKey}`}
              className="font-mono uppercase transition-colors"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              {COPY.next}
            </Link>
          )}
          <Link
            href="/reflections"
            className="font-mono uppercase transition-colors"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-3)",
            }}
          >
            {COPY.seeEverything}
          </Link>
        </div>
      </div>

      <div
        className="rounded-[4px] px-4 py-[14px]"
        style={{ background: "var(--rf-surface)" }}
      >
        <p
          className="mb-[10px]"
          style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
        >
          {month.label}
        </p>

        <div className="grid grid-cols-7 gap-[3px]">
          {WEEKDAYS.map((d, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="pb-1 text-center font-mono uppercase"
              style={{
                fontSize: "8.5px",
                letterSpacing: "0.08em",
                color: "var(--rf-text-4)",
              }}
            >
              {d}
            </span>
          ))}

          {Array.from({ length: month.leadingBlanks }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden="true" />
          ))}

          {month.days.map((day) => {
            const marked = day.kinds.length > 0;
            const inner = (
              <>
                <span
                  style={{
                    fontSize: "11.5px",
                    color: day.isFuture
                      ? "var(--rf-text-4)"
                      : marked
                        ? "var(--rf-text)"
                        : "var(--rf-text-3)",
                  }}
                >
                  {day.dayOfMonth}
                </span>
                {/* Always reserves the dot row's height, so a day with records
                    and a day without are the same size and the grid does not
                    shift as the month fills. */}
                <span
                  className="flex items-center justify-center gap-[2px]"
                  style={{ height: 5 }}
                >
                  {day.kinds.map((k) => (
                    <Dot key={k} kind={k} />
                  ))}
                </span>
              </>
            );

            const cell = (
              <span
                className="flex flex-col items-center justify-center gap-[3px] rounded-[3px]"
                style={{
                  paddingTop: 6,
                  paddingBottom: 6,
                  background: marked ? "var(--rf-paper)" : "transparent",
                  boxShadow: day.isToday
                    ? "inset 0 0 0 1px var(--rf-accent)"
                    : "none",
                }}
              >
                {inner}
              </span>
            );

            // Only a day with something on it is a link. A link to an empty day
            // would open a filtered archive showing nothing, which reads as broken.
            return marked ? (
              <Link
                key={day.date}
                href={`/reflections?from=${day.date}&to=${day.date}`}
                aria-label={COPY.dayLabel(
                  day.date,
                  day.kinds.map((k) => KIND_LABEL[k]).join(", ")
                )}
                className="transition-colors"
              >
                {cell}
              </Link>
            ) : (
              <span key={day.date}>{cell}</span>
            );
          })}
        </div>

        <div className="mt-[12px] flex flex-wrap items-center gap-x-4 gap-y-1">
          {(Object.keys(KIND_LABEL) as DayKind[]).map((k) => (
            <span key={k} className="flex items-center gap-[5px]">
              <Dot kind={k} />
              <span style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}>
                {KIND_LABEL[k]}
              </span>
            </span>
          ))}
        </div>

        {!month.anyRecords && (
          <p
            className="mt-[10px]"
            style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
          >
            {COPY.empty}
          </p>
        )}
      </div>
    </section>
  );
}
