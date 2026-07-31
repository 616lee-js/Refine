/**
 * A line over time.
 *
 * ── No band shading ───────────────────────────────────────────────────────────
 * The design reference shaded severity bands behind the line. That is
 * deliberately not ported. Shading a threshold behind someone's data makes the
 * threshold look like a property of them, and crossing it reads as an event
 * that happened. The same information goes in a key beside the chart, where it
 * stays a property of the instrument — see BandKey below.
 *
 * Nothing here is coloured by value. A high reading is drawn exactly like a low
 * one.
 */

export function LineChart({
  data,
  labels,
  max,
  color = "var(--rf-accent)",
  height = 116,
  ariaLabel,
}: {
  data: number[];
  labels: string[];
  max: number;
  color?: string;
  height?: number;
  ariaLabel: string;
}) {
  if (data.length === 0) return null;

  // viewBox coordinates with preserveAspectRatio="none" on the x axis would
  // distort the dots, so the chart is drawn in a fixed coordinate space and
  // scaled by CSS width instead.
  const w = 420;
  const pad = { l: 26, r: 10, t: 10, b: 18 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const x = (i: number) =>
    data.length === 1 ? pad.l + iw / 2 : pad.l + (i / (data.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - (Math.min(v, max) / max) * ih;

  const line = data
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${pad.t + ih} L${pad.l} ${
    pad.t + ih
  } Z`;

  const gridlines = [0, max / 3, (max / 3) * 2, max];

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", overflow: "visible" }}
    >
      {gridlines.map((v, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--rf-rule)"
            strokeWidth="1"
          />
          <text
            x={0}
            y={y(v) + 3.5}
            fill="var(--rf-text-4)"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
          >
            {Math.round(v * 10) / 10}
          </text>
        </g>
      ))}

      <path d={area} fill={color} opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === data.length - 1 ? 3.4 : 2.2}
          fill={i === data.length - 1 ? color : "var(--rf-paper)"}
          stroke={color}
          strokeWidth="1.4"
        />
      ))}
      {labels.map((l, i) =>
        l ? (
          <text
            key={i}
            x={x(i)}
            y={height - 2}
            textAnchor="middle"
            fill="var(--rf-text-4)"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8.5,
              letterSpacing: ".06em",
            }}
          >
            {l}
          </text>
        ) : null
      )}
    </svg>
  );
}

/**
 * The instrument's own scoring ranges, beside the chart rather than behind it.
 *
 * Nothing marks "where you are". The key says what the instrument's published
 * ranges are; the number is on the card. Joining them is the reader's to do,
 * and a clinician's to do properly.
 */
export function BandKey({
  rows,
  provenance,
}: {
  rows: { label: string; range: string }[];
  provenance: string | null;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4">
          <span
            style={{
              fontSize: "12px",
              color: "var(--rf-text-2)",
              textTransform: "capitalize",
            }}
          >
            {r.label}
          </span>
          <span
            className="font-mono"
            style={{ fontSize: "10px", color: "var(--rf-text-4)" }}
          >
            {r.range}
          </span>
        </div>
      ))}
      {provenance && (
        <p
          className="mt-[6px]"
          style={{
            fontSize: "11px",
            lineHeight: 1.5,
            color: "var(--rf-text-4)",
            textWrap: "pretty",
          }}
        >
          {provenance}
        </p>
      )}
    </div>
  );
}
