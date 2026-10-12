"use client";

import { useRef, useState } from "react";

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
 *
 * ── Why this is a client component ────────────────────────────────────────────
 * It was a pure server-rendered SVG until 2026-10-12. It now shows the exact
 * date and value of a point when you point at it, focus it, or tap it — the
 * product owner asked for it, and the chart is where the figures are, so this is
 * the only place that answer exists.
 *
 * The design package says "no tooltips-by-default". This is not default chrome:
 * nothing appears until someone asks a point what it says.
 *
 * ── Dates arrive already formatted ───────────────────────────────────────────
 * `labels` and `dates` are strings, never `Date` objects, and that is not
 * incidental. Formatting a date in the browser produced a real hydration
 * mismatch in this codebase before — the server and the viewer's machine
 * disagree about locale and timezone, and React tears the whole tree down. Dates
 * are formatted on the server and shipped as text. See
 * src/app/(protected)/reflections/records.ts.
 */

export function LineChart({
  data,
  labels,
  dates,
  max,
  unit = "",
  color = "var(--rf-accent)",
  height = 116,
  ariaLabel,
}: {
  data: number[];
  /**
   * Short form, one per point — "25 Sep". The axis cannot carry one of these per
   * point without becoming a row of overlapping text, so this component picks
   * which to print. It receives all of them because it also needs to know what
   * it is choosing between; the caller used to pre-blank the ones it thought
   * should not show, and then there was nothing to recover for the readout.
   */
  labels: string[];
  /**
   * Long form, one per point — "25 Sep 2026". Shown in the readout, where the
   * year matters: a record spanning two years has two "25 Sep"s in it.
   */
  dates: string[];
  max: number;
  /** Appended to the value in the readout, e.g. "h". */
  unit?: string;
  color?: string;
  height?: number;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  /**
   * Which point is being asked about, where it sits inside the wrapper, and
   * whether it is close enough to an edge that the readout has to tuck in rather
   * than centre. All three are settled at the moment of measurement, so nothing
   * here is read back out of the DOM while rendering.
   */
  const [active, setActive] = useState<{
    i: number;
    x: number;
    y: number;
    edge: "left" | "right" | null;
  } | null>(null);

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

  /**
   * Which dates the axis prints: first, middle, last.
   *
   * One per point is a row of unreadable overlapping text, and this is the
   * cheapest honest subset — the ends say what the chart spans and the middle
   * says roughly where the bend is. The readout covers everything in between.
   */
  const onAxis = (i: number) =>
    i === 0 ||
    i === data.length - 1 ||
    i === Math.floor(data.length / 2);

  /**
   * Where the readout goes, measured rather than computed.
   *
   * The arithmetic is tempting — the point's position in the 420-wide drawing is
   * known exactly — but the drawing is not guaranteed to fill its box. The SVG
   * keeps its aspect ratio, so a container wider than 420 leaves a gutter either
   * side and the percentage would be wrong by half of it.
   *
   * Measuring the circle at the moment of interaction is exact at every width,
   * and needs no resize listener: the readout is only on screen while someone is
   * pointing at or focused on a point, and it is re-measured the next time.
   */
  function show(i: number, el: SVGElement) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const dot = el.getBoundingClientRect();
    const cx = dot.left + dot.width / 2 - box.left;
    /*
     * Centred over its point everywhere except within 56px of either end, where
     * centring would hang the readout off the side of the card. There it tucks
     * in against the edge instead.
     */
    setActive({
      i,
      x: cx,
      y: dot.top + dot.height / 2 - box.top,
      edge: cx < 56 ? "left" : box.width - cx < 56 ? "right" : null,
    });
  }

  /** Arrow keys walk the line, so the readout is reachable without a pointer. */
  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    const step =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) {
      if (e.key === "Escape") setActive(null);
      return;
    }
    e.preventDefault();
    const from = active ? active.i : step > 0 ? -1 : data.length;
    const next = Math.max(0, Math.min(data.length - 1, from + step));
    const dot = e.currentTarget.querySelector<SVGElement>(
      `[data-dot="${next}"]`
    );
    if (dot) show(next, dot);
  }

  const value = (v: number) => `${Math.round(v * 10) / 10}${unit}`;

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
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
            data-dot={i}
            cx={x(i)}
            cy={y(v)}
            r={
              active?.i === i
                ? 4.4
                : i === data.length - 1
                  ? 3.4
                  : 2.2
            }
            fill={
              active?.i === i || i === data.length - 1
                ? color
                : "var(--rf-paper)"
            }
            stroke={color}
            strokeWidth="1.4"
          />
        ))}

        {/*
         * Hit targets. A 2.2-unit dot is about two pixels across and nobody is
         * hitting that with a finger, so each point gets an invisible 9-unit
         * circle over it. Drawn last so they sit above the line.
         */}
        {data.map((v, i) => (
          <circle
            key={`hit-${i}`}
            cx={x(i)}
            cy={y(v)}
            r={9}
            fill="transparent"
            onPointerEnter={(e) => show(i, e.currentTarget)}
            onPointerDown={(e) => show(i, e.currentTarget)}
            style={{ cursor: "pointer" }}
          />
        ))}

        {labels.map((l, i) =>
          l && onAxis(i) ? (
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

      {active && (
        <div
          // Polite, so arrowing along the line reads each point out rather than
          // interrupting itself.
          aria-live="polite"
          style={{
            position: "absolute",
            left: active.edge === "left" ? 0 : active.edge === "right" ? undefined : active.x,
            right: active.edge === "right" ? 0 : undefined,
            top: active.y - 10,
            transform: `translate(${active.edge ? "0" : "-50%"}, -100%)`,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            padding: "4px 7px",
            borderRadius: 4,
            background: "var(--rf-paper)",
            boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: ".04em",
            color: "var(--rf-text-2)",
            zIndex: 1,
          }}
        >
          {dates[active.i]} · {value(data[active.i])}
        </div>
      )}
    </div>
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
