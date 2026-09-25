"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import { EntrySummaryPanel, type EntrySummaryPanelProps } from "./entry-summary";
import { EntryBody } from "./entry-body";

/**
 * The summary panel and the entry text, together.
 *
 * They are one client component because select-to-quote crosses between them:
 * a selection made in the text becomes a quote in the summary's correction
 * draft. The server page decrypts and passes plain props; nothing here fetches.
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
}: {
  body: string;
  decryptFailed: boolean;
  summary: Omit<EntrySummaryPanelProps, "pendingQuote" | "onQuoteConsumed">;
}) {
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);

  return (
    <>
      <EntrySummaryPanel
        {...summary}
        pendingQuote={pendingQuote}
        onQuoteConsumed={() => setPendingQuote(null)}
      />

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
    </>
  );
}
