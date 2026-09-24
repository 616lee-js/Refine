import Link from "next/link";
import { Sheet, Eyebrow } from "./sheet";

/**
 * One record, as a card. The only card in the product.
 *
 * ── What went wrong before this existed ───────────────────────────────────────
 * Every browsing surface — archive, home's recent list, trash, the check-in
 * panel — drew its own rows inside a single `<Sheet>` separated by hairlines.
 * Four near-identical implementations, none of them a card, and restyling the
 * contents of a row does not change that. This is the shared component those
 * four now use, so a change to how a record looks happens once.
 *
 * ── The title is the mechanism and the date ───────────────────────────────────
 * "Writing · Mon 22 Sep", never the entry's own title, and never a placeholder
 * standing in for one. What distinguishes two records in a list is what kind of
 * thing they are and when they happened; a user-set title is a property of the
 * record and belongs in the main view where the record is read.
 *
 * That also removes the double date — the old row printed the date in a column
 * AND again as the fallback title of an untitled entry.
 *
 * ── The subheader says what it was about ──────────────────────────────────────
 * Categories for a piece of writing, the day's values for a check-in. Supplied
 * by the caller because only the caller knows how to derive it; this component
 * does not decrypt, query, or interpret anything.
 */

export type RecordCardProps = {
  href: string;
  /** "Writing", "Check-in", "GAD-7" — the mechanism, not the content. */
  kindLabel: string;
  at: Date;
  /** Categories, or a check-in's values. Joined with · and clamped to 2 lines. */
  detail?: string[];
  /** The record open in the main view. */
  selected?: boolean;
  /** Framework records carry the accent; writing and check-ins stay quiet. */
  accent?: boolean;
  /** Written but never completed. */
  draft?: boolean;
  /** Completed, but Cabinet 2 has not caught up. */
  awaitingSummary?: boolean;
  /** Shown under the subheader — "Unfinished", "Summarising…". */
  statusLabel?: string;
};

export function RecordCard({
  href,
  kindLabel,
  at,
  detail = [],
  selected = false,
  accent = false,
  statusLabel,
}: RecordCardProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className="block transition-colors"
    >
      <Sheet
        className="px-[15px] py-[13px]"
        // The selected card is the one being read. It reads as lifted rather
        // than highlighted: an accent fill on a list of a person's own writing
        // would make the list feel like a control panel.
        style={
          selected
            ? {
                background: "var(--rf-accent-soft)",
                boxShadow: "inset 0 0 0 1px var(--rf-accent)",
              }
            : undefined
        }
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span
            className="font-mono uppercase"
            style={{
              // Matched to the date beside it. At 9.5px the kind read as a
              // caption on the date rather than as the card's title, which is
              // backwards — the kind and the date are the title, together.
              // Tracking is pulled in from 0.14em, since uppercase mono at this
              // size does not need as much to stay legible.
              fontSize: "14px",
              letterSpacing: "0.08em",
              fontWeight: 500,
              color: accent ? "var(--rf-accent)" : "var(--rf-text-3)",
            }}
          >
            {kindLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "14px",
              color: "var(--rf-text-2)",
            }}
          >
            {at.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        {detail.length > 0 && (
          <p
            className="mt-[5px]"
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              color: "var(--rf-text-2)",
              // Two lines, then ellipsis. A card is a card, not a summary.
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {detail.join(" · ")}
          </p>
        )}

        {statusLabel && (
          <div className="mt-[6px]">
            <Eyebrow size={9}>{statusLabel}</Eyebrow>
          </div>
        )}
      </Sheet>
    </Link>
  );
}

/**
 * The container. Cards are separated by gaps, not hairlines — the gap is what
 * makes each one a discrete object rather than a row in a table.
 */
export function RecordCardList({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col gap-[10px] ${className}`}>{children}</div>;
}
