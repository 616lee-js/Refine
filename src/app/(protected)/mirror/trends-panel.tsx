import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { LineChart, BandKey } from "@/components/ui/line-chart";
import { DotMatrix } from "@/components/ui/dot-matrix";
import {
  MIN_LINE_READINGS,
  MIN_MATRIX_DAYS,
  type LineCard,
  type MatrixCard,
  type Trends,
} from "@/lib/trends";

/**
 * Trends.
 *
 * Every card here is charted or gathering; absent cards never reach this
 * component. See src/lib/trends/index.ts for why those three states exist.
 *
 * CONTENT PASS: all copy in this file is placeholder — the gathering lines, the
 * "Plainly" heading and its footnote, and the instrument provenance strings.
 */

function ChartCard({
  label,
  meta,
  reading,
  note,
  wide,
  children,
}: {
  label: string;
  meta: string;
  reading?: string;
  note?: string | null;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      className={`px-5 pb-[13px] pt-[14px] ${wide ? "lg:col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>{label}</Eyebrow>
          {reading && (
            <div className="mt-[6px] flex items-baseline gap-[9px]">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "27px",
                  lineHeight: 1,
                  color: "var(--rf-text)",
                }}
              >
                {reading}
              </span>
              {note && (
                <span
                  style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
                >
                  {note}
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className="shrink-0 text-right font-mono uppercase"
          style={{
            maxWidth: 130,
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            lineHeight: 1.5,
            color: "var(--rf-text-4)",
          }}
        >
          {meta}
        </span>
      </div>
      <div className="mt-[11px]">{children}</div>
    </Sheet>
  );
}

/**
 * Started, but not enough yet.
 *
 * Deliberately not an empty state: someone who answered twice and sees nothing
 * will conclude it was not recorded. This says the readings exist and what the
 * chart is waiting for.
 */
function Gathering({
  label,
  count,
  needed,
  unit,
}: {
  label: string;
  count: number;
  needed: number;
  unit: string;
}) {
  return (
    <Sheet className="px-5 py-[16px]">
      <Eyebrow>{label}</Eyebrow>
      <p
        className="mt-[9px]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          lineHeight: 1.55,
          color: "var(--rf-text-2)",
          textWrap: "pretty",
        }}
      >
        {count} {count === 1 ? unit : `${unit}s`} so far. A line needs {needed}.
      </p>
    </Sheet>
  );
}

function Line({ card }: { card: LineCard }) {
  if (card.state === "gathering") {
    return (
      <Gathering
        label={card.label}
        count={card.count}
        needed={MIN_LINE_READINGS}
        unit="reading"
      />
    );
  }

  const chart = (
    <LineChart
      data={card.points}
      labels={card.labels}
      max={card.max}
      color={card.bandKey ? "var(--rf-accent)" : "var(--rf-accent-2)"}
      ariaLabel={`${card.label}: ${card.count} readings, most recent ${card.reading}`}
    />
  );

  return (
    <ChartCard
      label={card.label}
      meta={card.meta}
      reading={card.reading}
      note={card.note}
      wide={card.wide}
    >
      {card.bandKey ? (
        // The key sits beside the chart, never behind it. Shading a threshold
        // under someone's line makes the threshold look like a fact about them.
        <div className="grid gap-6 lg:grid-cols-[1fr_190px]">
          {chart}
          <div className="lg:border-l lg:pl-5" style={{ borderColor: "var(--rf-rule)" }}>
            <Eyebrow size={9}>Scoring ranges</Eyebrow>
            <div className="mt-[9px]">
              <BandKey rows={card.bandKey} provenance={card.provenance} />
            </div>
          </div>
        </div>
      ) : (
        chart
      )}
    </ChartCard>
  );
}

function Matrix({ card }: { card: MatrixCard }) {
  if (card.state === "gathering") {
    return (
      <Gathering
        label={card.label}
        count={card.count}
        needed={MIN_MATRIX_DAYS}
        unit="day"
      />
    );
  }
  return (
    <ChartCard label={card.label} meta={card.meta} wide>
      <DotMatrix rows={card.rows} />
    </ChartCard>
  );
}

export function TrendsPanel({ trends }: { trends: Trends }) {
  return (
    <div className="flex flex-col gap-[14px] pb-6">
      <div className="grid gap-[14px] lg:grid-cols-2">
        {trends.cards.map((card) =>
          card.kind === "line" ? (
            <Line key={card.id} card={card} />
          ) : (
            <Matrix key={card.id} card={card} />
          )
        )}
      </div>

      {trends.plainly && (
        <Sheet className="px-6 py-5">
          <Eyebrow>Plainly</Eyebrow>
          <p
            className="mt-3 max-w-[620px]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              lineHeight: 1.6,
              color: "var(--rf-text)",
              textWrap: "pretty",
            }}
          >
            {trends.plainly}
          </p>
          <p
            className="mt-3 max-w-[560px]"
            style={{
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "var(--rf-text-4)",
            }}
          >
            A count of what you logged, not a diagnosis and not a cause. Bring it
            to someone qualified if it looks worth acting on.
          </p>
        </Sheet>
      )}
    </div>
  );
}
