"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import { EntrySummaryPanel, type EntrySummaryPanelProps } from "./entry-summary";
import { EntryBody } from "./entry-body";
import { AssessSummary, AssessSummaryTrigger } from "./assess-summary";
import type { EntrySummary } from "@/lib/summaries/types";

/**
 * The summary panel and the entry text, side by side.
 *
 * They are one client component because select-to-quote crosses between them:
 * a selection made in the text becomes a quote in the summary's correction
 * draft. The server page decrypts and passes plain props; nothing here fetches.
 *
 * ── Two columns of the same height, from `lg` up ───────────────────────────────
 * Summary left, the writing right, both the height of the summary, and a long
 * entry scrolls inside its own box rather than running the page down past the
 * thing it is being compared with. Stacked below `lg`, where the entry is never
 * capped and the page scrolls as it always did.
 *
 * The heights match without measuring anything. The entry column's contents are
 * taken out of the flow (`lg:absolute lg:inset-0`), so they contribute no height
 * and the row is sized by the summary column alone; the entry box then fills that
 * height and scrolls. A minimum height stops a one-line summary from reducing the
 * writing to a slot.
 *
 * ── Assess sits with the summary, its form does not ───────────────────────────
 * The button belongs beside what it judges. The form it opens is a two-column
 * comparison that needs the whole view, so it renders full width underneath, and
 * the open state lives here between the two. See ./assess-summary.tsx.
 */

// COPY REVIEW: `[COPY]` items are placeholders; the rest is shipped wording.
const COPY = {
  yourWords: "[COPY] Your words",
  decryptFailed:
    "[COPY] This entry could not be read. Its content is still stored, but the encryption key does not match — nothing has been lost, and it should not be edited or overwritten until that is resolved.",
  emptyBody: "[COPY] This one is empty.",
} as const;

/**
 * The shortest the two columns may be.
 *
 * A thin entry can produce a summary panel only a few lines tall, and matching
 * the writing to that would leave it unreadable. Both columns stretch to at least
 * this, so they still match each other.
 */
const MIN_COLUMN_HEIGHT = 420;

export function ReadBack({
  body,
  decryptFailed,
  summary,
  assess,
}: {
  body: string;
  decryptFailed: boolean;
  summary: Omit<EntrySummaryPanelProps, "pendingQuote" | "onQuoteConsumed">;
  /**
   * Null when there is nothing to judge — no readable summary, or no readable
   * body. The page decides; see its call site for why it is the AI's original.
   */
  assess: { entryId: string; summary: EntrySummary; corrected: boolean } | null;
}) {
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [assessOpen, setAssessOpen] = useState(false);

  return (
    <>
      <div
        className="lg:grid lg:items-stretch lg:gap-7 lg:[grid-template-columns:0.8fr_1.2fr]"
        style={{ minHeight: MIN_COLUMN_HEIGHT }}
      >
        {/* ── What Refine took ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          <EntrySummaryPanel
            {...summary}
            pendingQuote={pendingQuote}
            onQuoteConsumed={() => setPendingQuote(null)}
          />

          {assess && !assessOpen && (
            <div className="mt-[14px]">
              <AssessSummaryTrigger onOpen={() => setAssessOpen(true)} />
            </div>
          )}
        </div>

        {/* ── The person's own words ───────────────────────────────────────────
            Labelled as theirs, against the summary's machine attribution beside
            it. The label is the smaller half of the distinction — the treatments
            differ structurally (serif on paper here, sans on a recessed panel
            there), so the two are still told apart with the page zoomed past the
            point of reading either. */}
        <div className="relative mt-[18px] min-w-0 lg:mt-0">
          <div className="lg:absolute lg:inset-0 lg:flex lg:min-h-0 lg:flex-col">
            <div className="mb-[8px] lg:shrink-0">
              <Eyebrow size={9.5}>{COPY.yourWords}</Eyebrow>
            </div>

            {/* 40/36, down from 48/44. The sheet spans its column rather than
                sitting inside a centred cap, so the old padding was buying
                margin the layout already provides. */}
            <Sheet className="px-10 py-9 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {decryptFailed ? (
                <Notice tone="error">{COPY.decryptFailed}</Notice>
              ) : body ? (
                // Capped for line length. A column as wide as the window is
                // fine for a summary or a notice and unreadable for prose — a
                // line that long loses the reader on the way back to the left
                // margin.
                <div className="max-w-[760px]">
                  <EntryBody body={body} onQuote={setPendingQuote} />
                </div>
              ) : (
                <p style={{ fontSize: "14px", color: "var(--rf-text-4)" }}>
                  {COPY.emptyBody}
                </p>
              )}
            </Sheet>
          </div>
        </div>
      </div>

      {/* Full width, underneath both columns: the form puts the summary and the
          entry in two columns of its own, and cannot do that inside one. */}
      {assess && (
        <AssessSummary
          entryId={assess.entryId}
          summary={assess.summary}
          corrected={assess.corrected}
          body={body}
          open={assessOpen}
          onClose={() => setAssessOpen(false)}
        />
      )}
    </>
  );
}
