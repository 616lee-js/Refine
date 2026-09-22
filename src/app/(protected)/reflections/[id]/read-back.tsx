"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { EntrySummaryPanel, type EntrySummaryPanelProps } from "./entry-summary";
import { EntryBody } from "./entry-body";

/**
 * The summary panel and the entry text, together.
 *
 * They are one client component because select-to-quote crosses between them:
 * a selection made in the text becomes a quote in the summary's correction
 * draft. The server page decrypts and passes plain props; nothing here fetches.
 */

// COPY REVIEW: shipped wording, hoisted for review.
const COPY = {
  decryptFailed:
    "This entry could not be read. Its content is still stored, but the encryption key does not match — nothing has been lost, and it should not be edited or overwritten until that is resolved.",
  emptyBody: "This one is empty.",
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

      <Sheet className="mt-[14px] px-9 py-9 sm:px-12 sm:py-11">
        {decryptFailed ? (
          <p
            className="rounded-[10px] px-5 py-4"
            style={{
              fontSize: "13.5px",
              lineHeight: 1.7,
              color: "var(--color-error)",
              background: "rgba(163, 58, 37, 0.08)",
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
