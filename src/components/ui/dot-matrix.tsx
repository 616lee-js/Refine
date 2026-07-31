/**
 * What happened, day by day — a record, not a streak.
 *
 * Three states per cell, and the third is the point: "no check-in that day" is
 * drawn differently from "checked in, didn't happen". Collapsing them would
 * turn every skipped day into a failure, which is the streak mechanic this
 * product refuses.
 *
 * There is no run length, no longest-streak number, and no colour that means
 * good. A filled cell is a fact.
 */

export type Cell = "yes" | "no" | "none";

export function DotMatrix({
  rows,
  color = "var(--rf-accent-2)",
}: {
  rows: { label: string; days: Cell[] }[];
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid items-center gap-x-[10px] gap-y-1 sm:grid-cols-[104px_1fr]"
        >
          <span style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}>
            {r.label}
          </span>
          <div className="flex gap-[3px]" role="img" aria-label={cellSummary(r)}>
            {r.days.map((c, i) => (
              <span
                key={i}
                className="flex-1"
                style={{
                  height: 13,
                  borderRadius: 2,
                  background: c === "yes" ? color : "transparent",
                  boxShadow:
                    c === "yes"
                      ? "none"
                      : c === "no"
                        ? "inset 0 0 0 1px var(--rf-border-strong)"
                        : "inset 0 0 0 1px var(--rf-rule)",
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-[10px] flex flex-wrap items-center gap-x-4 gap-y-2">
        {(
          [
            ["yes", "Happened"],
            ["no", "Didn't"],
            ["none", "No check-in"],
          ] as const
        ).map(([state, label]) => (
          <span key={state} className="flex items-center gap-[6px]">
            <span
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                background: state === "yes" ? color : "transparent",
                boxShadow:
                  state === "yes"
                    ? "none"
                    : state === "no"
                      ? "inset 0 0 0 1px var(--rf-border-strong)"
                      : "inset 0 0 0 1px var(--rf-rule)",
              }}
            />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function cellSummary(r: { label: string; days: Cell[] }): string {
  const yes = r.days.filter((d) => d === "yes").length;
  const logged = r.days.filter((d) => d !== "none").length;
  return `${r.label}: ${yes} of ${logged} logged days`;
}
