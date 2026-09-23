import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { loadRail, type ArchiveSearchParams } from "./records";
import { ArchiveShell } from "./archive-shell";

/**
 * The archive — the rail with nothing selected.
 *
 * Master–detail: records are cards in the left rail, and a record opens in the
 * main view. This page is that layout before a choice has been made, so the
 * main pane says what the rail is for rather than sitting empty.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  headline: "[COPY] Everything you've written",
  lede: "[COPY] Every entry, check-in and questionnaire you've recorded. Pick one to read it.",
  emptyTitle: "[COPY] Nothing here yet",
  emptyBody: "[COPY] What you write and log will collect here.",
  start: "[COPY] Start something",
} as const;

export default async function ReflectionsPage({
  searchParams,
}: {
  searchParams: Promise<ArchiveSearchParams>;
}) {
  const params = await searchParams;
  const authSession = await getSession();
  const rail = await loadRail(authSession.userId!, params);

  return (
    <ArchiveShell {...rail}>
      <div className="pb-[14px]">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "30px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
          }}
        >
          {COPY.headline}
        </h1>
        <p
          className="mt-[8px] max-w-[440px]"
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--rf-text-3)",
          }}
        >
          {COPY.lede}
        </p>
      </div>

      {rail.total === 0 && (
        <Sheet className="px-8 py-14 text-center">
          <Eyebrow size={9.5}>{COPY.emptyTitle}</Eyebrow>
          <p
            className="mt-[10px]"
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              color: "var(--rf-text-3)",
            }}
          >
            {COPY.emptyBody}
            <br />
            <Link
              href="/"
              className="underline underline-offset-[3px]"
              style={{
                color: "var(--rf-text-2)",
                textDecorationColor: "var(--rf-border-strong)",
              }}
            >
              {COPY.start}
            </Link>
          </p>
        </Sheet>
      )}
    </ArchiveShell>
  );
}
