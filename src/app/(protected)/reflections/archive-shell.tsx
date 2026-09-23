import { PageBg } from "@/components/ui/page-bg";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { RecordRail, type RailView } from "./record-rail";
import type { ArchiveRecord, CategoryOption } from "./records";

/**
 * The archive frame: rail on the left, the record in the main view.
 *
 * ── Why this is a component and not a layout ──────────────────────────────────
 * The rail is built from the filter parameters in the URL, and the App Router
 * does not pass `searchParams` to layouts — only to pages. So every archive page
 * renders the rail itself, and this holds the frame so the pages cannot drift
 * apart. Same reasoning as `./records.ts` holding the query.
 *
 * ── Gutters ───────────────────────────────────────────────────────────────────
 * Narrower than the single-column screens. The rail already occupies the left
 * side, so the wide page gutter that reads as margin on a centred column reads
 * as wasted space here.
 */
export function ArchiveShell({
  records,
  categories,
  total,
  view,
  selectedId,
  children,
}: {
  records: ArchiveRecord[];
  categories: CategoryOption[];
  total: number;
  view: RailView;
  selectedId?: string;
  children: React.ReactNode;
}) {
  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-4 pt-[26px] sm:px-6">
        <div
          className="flex w-full flex-col gap-8 pb-14 lg:flex-row lg:items-start lg:gap-9"
          style={{ maxWidth: 1240 }}
        >
          <RecordRail
            records={records}
            categories={categories}
            total={total}
            view={view}
            selectedId={selectedId}
          />

          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </PageBg>
  );
}
