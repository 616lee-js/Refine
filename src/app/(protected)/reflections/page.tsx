import Link from "next/link";
import { getSession } from "@/lib/auth";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { loadRecords, parseFilters } from "./records";
import { RecordRail, type RailView } from "./record-rail";

/**
 * The archive — the rail with nothing selected.
 *
 * Master–detail: records are cards in the left rail, and a record opens in the
 * main view. This page is that layout before a choice has been made, so the
 * main pane says what the rail is for rather than sitting empty.
 * `/reflections/[id]` renders the same rail with the record in the main pane.
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
  searchParams: Promise<{
    filter?: string;
    category?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const { range, ...filters } = parseFilters(params);

  const authSession = await getSession();
  const userId = authSession.userId!;

  const { records, categories, total } = await loadRecords(userId, filters);

  const view: RailView = {
    kind: filters.kind,
    range,
    from: params.from ?? null,
    to: params.to ?? null,
    category: filters.category,
    q: filters.q,
  };

  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div
          className="flex w-full flex-col gap-8 pb-14 lg:flex-row lg:items-start lg:gap-10"
          style={{ maxWidth: 1100 }}
        >
          <RecordRail
            records={records}
            categories={categories}
            total={total}
            view={view}
          />

          <main className="flex min-w-0 flex-1 flex-col">
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

            {total === 0 && (
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
          </main>
        </div>
      </div>
    </PageBg>
  );
}
