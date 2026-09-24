import { Suspense } from "react";
import { PageBg } from "@/components/ui/page-bg";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { RecordRail } from "./record-rail";
import { RailSkeleton } from "./rail-skeleton";
import { loadRail, type ArchiveSearchParams } from "./records";

/**
 * The archive frame: the record list on the left, the record in the main view.
 *
 * ── Why this is a component and not a layout ──────────────────────────────────
 * The list is built from the filter parameters in the URL, and the App Router
 * does not pass `searchParams` to layouts — only to pages. So every archive page
 * renders it, and this holds the frame so the pages cannot drift apart. Same
 * reasoning as `./records.ts` holding the query.
 *
 * ── The record does not wait for the list ─────────────────────────────────────
 * Opening a record is two cheap queries; building the list means reading and
 * decrypting up to fifty. Rendering them together meant every click waited on
 * the slow half to see the thing that was clicked.
 *
 * The list is now inside a `<Suspense>` boundary, so the record streams first
 * and the list arrives behind it. `RailSkeleton` holds the exact width in the
 * meantime, so nothing shifts sideways when the real one lands.
 *
 * ── Gutters and width ─────────────────────────────────────────────────────────
 * Narrower gutters than the single-column screens, and a wider container than
 * them too. The list already occupies the left side, so the page margin that
 * reads as breathing room around a centred column reads as wasted space here —
 * and because the whole thing is centred, a narrow container pushes the list
 * inward toward the middle of the screen rather than letting it sit out to the
 * left where it belongs.
 */
export function ArchiveShell({
  userId,
  searchParams,
  selectedId,
  children,
}: {
  userId: string;
  /** The filters, straight from the URL. Resolved inside the boundary. */
  searchParams: ArchiveSearchParams;
  selectedId?: string;
  children: React.ReactNode;
}) {
  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-4 pt-[26px] sm:px-6">
        <div
          className="flex w-full flex-col gap-8 pb-14 lg:flex-row lg:items-start lg:gap-9"
          style={{ maxWidth: 1440 }}
        >
          <Suspense fallback={<RailSkeleton />}>
            <RailData
              userId={userId}
              searchParams={searchParams}
              selectedId={selectedId}
            />
          </Suspense>

          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </PageBg>
  );
}

/**
 * The list, loaded inside the boundary so its queries do not hold up the
 * record beside it.
 */
async function RailData({
  userId,
  searchParams,
  selectedId,
}: {
  userId: string;
  searchParams: ArchiveSearchParams;
  selectedId?: string;
}) {
  const rail = await loadRail(userId, searchParams);
  return <RecordRail {...rail} selectedId={selectedId} />;
}
