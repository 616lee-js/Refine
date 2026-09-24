/**
 * What sits in the left column while the real list loads.
 *
 * ── It must hold the same width ───────────────────────────────────────────────
 * Same `lg:w-[340px]`, same panel padding and border as the real list. If this
 * were narrower, the record beside it would render at one width and then jump
 * sideways when the list arrived — which is worse than waiting.
 *
 * ── It is deliberately vague ──────────────────────────────────────────────────
 * Bars, not fake records. A placeholder that mimics real cards reads as content
 * for the moment before it is replaced, and the flicker of near-real text
 * turning into different near-real text is more distracting than an obvious
 * placeholder. Nothing here is announced to screen readers.
 */
function Bar({ w, h = 10 }: { w: string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 3,
        background: "var(--rf-border)",
        opacity: 0.55,
      }}
    />
  );
}

export function RailSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="w-full shrink-0 rounded-[4px] p-3 lg:w-[340px]"
      style={{
        background: "var(--rf-surface)",
        boxShadow: "inset 0 0 0 1px var(--rf-border)",
      }}
    >
      <div className="mb-3">
        <Bar w="52px" h={8} />
      </div>

      {/* The two date boxes and the search box. */}
      <div className="flex gap-2">
        <Bar w="100%" h={24} />
        <Bar w="100%" h={24} />
      </div>
      <div className="mt-2">
        <Bar w="100%" h={26} />
      </div>

      {/* The row of type buttons. */}
      <div className="mt-2 flex gap-[5px]">
        <Bar w="38px" h={20} />
        <Bar w="56px" h={20} />
        <Bar w="64px" h={20} />
        <Bar w="62px" h={20} />
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--rf-border)" }}>
        <Bar w="28px" h={8} />
      </div>

      {/* A few record-shaped spaces, enough to fill the fold without
          pretending to be a specific number of records. */}
      <div className="mt-2 flex flex-col gap-[10px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[3px] px-[15px] py-[13px]"
            style={{
              background: "var(--rf-paper)",
              border: "1px solid var(--rf-paper-edge)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <Bar w="54px" h={8} />
              <Bar w="66px" h={9} />
            </div>
            <div className="mt-[7px]">
              <Bar w="72%" h={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
