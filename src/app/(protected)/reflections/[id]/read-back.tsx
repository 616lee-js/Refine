"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import { EntrySummaryPanel, type EntrySummaryPanelProps } from "./entry-summary";
import { EntryBody } from "./entry-body";
import { AssessSummary, AssessSummaryTrigger } from "./assess-summary";
import type { EntrySummary } from "@/lib/summaries/types";

/**
 * The summary panel and the entry text, stacked.
 *
 * They are one client component because select-to-quote crosses between them:
 * a selection made in the text becomes a quote in the summary's correction
 * draft. The server page decrypts and passes plain props; nothing here fetches.
 *
 * ── Reading is one column; comparing is two ───────────────────────────────────
 * This page is for re-reading an entry, so the writing keeps the full width and
 * is never capped or scrolled inside a box. Putting the summary beside it was
 * tried and reverted: side-by-side belongs to the assessment, where the summary
 * is deliberately being checked against the entry, and the two must be in view at
 * once. See ./assess-summary.tsx.
 *
 * ── Assess sits with the summary, its form does not ───────────────────────────
 * The button belongs beside what it judges rather than below the entry, which is
 * where it used to be. The form it opens is the two-column comparison, so it
 * renders full width underneath, and the open state lives here between the two.
 */

// COPY REVIEW: `[COPY]` items are placeholders; the rest is shipped wording.
const COPY = {
  yourWords: "[COPY] Your words",
  decryptFailed:
    "[COPY] This entry could not be read. Its content is still stored, but the encryption key does not match — nothing has been lost, and it should not be edited or overwritten until that is resolved.",
  emptyBody: "[COPY] This one is empty.",
} as const;

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

      {/* The entry is labelled as the person's own, against the summary's
          machine attribution above it. The label is the smaller half of the
          distinction — the treatments differ structurally (serif on paper here,
          sans on a recessed panel there), so the two are still told apart with
          the page zoomed past the point of reading either. */}
      <div className="mt-[18px] mb-[8px]">
        <Eyebrow size={9.5}>{COPY.yourWords}</Eyebrow>
      </div>

      {/* 40/36, down from 48/44. The sheet now spans the main view rather than
          sitting inside a centred cap, so the old padding was buying margin the
          layout already provides. Only the text inside is capped — see below. */}
      <Sheet className="px-10 py-9">
        {decryptFailed ? (
          <Notice tone="error">{COPY.decryptFailed}</Notice>
        ) : body ? (
          // The only thing capped. A sheet as wide as the window is fine for a
          // summary or a notice and unreadable for prose — a line that long
          // loses the reader on the way back to the left margin.
          <div className="max-w-[760px]">
            <EntryBody body={body} onQuote={setPendingQuote} />
          </div>
        ) : (
          <p style={{ fontSize: "14px", color: "var(--rf-text-4)" }}>
            {COPY.emptyBody}
          </p>
        )}
      </Sheet>

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
