"use client";

import { useState } from "react";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
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

      <Sheet className="px-9 py-9 sm:px-12 sm:py-11">
        {decryptFailed ? (
          <p
            className="rounded-[10px] px-5 py-4"
            style={{
              fontSize: "13.5px",
              lineHeight: 1.7,
              color: "var(--color-error)",
              background: "var(--rf-error-soft)",
            }}
          >
            {COPY.decryptFailed}
          </p>
        ) : body ? (
          <EntryBody body={body} onQuote={setPendingQuote} />
        ) : (
          <p style={{ fontSize: "14px", color: "var(--rf-text-4)" }}>
            {COPY.emptyBody}
          </p>
        )}
      </Sheet>
    </>
  );
}
