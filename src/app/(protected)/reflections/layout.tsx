import { getSession } from "@/lib/auth";
import { PageBg } from "@/components/ui/page-bg";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { RecordRail } from "./record-rail";
import { loadRail } from "./records";

/**
 * The archive frame: the record list on the left, the record in the main view.
 *
 * ── Why a layout, and not a component each page renders ───────────────────────
 * This was a shared component until 2026-09-24, which meant every page rendered
 * its own copy of the list. Clicking a record re-ran its queries, re-decrypted
 * up to fifty records and flashed the placeholder back in — the record opened,
 * but the whole screen rebuilt around it, which reads as the page reloading
 * rather than the view changing.
 *
 * React keeps a layout's subtree mounted across navigation to any child route.
 * Here, that means the list renders once per full page load and then simply
 * stays while records open beside it.
 *
 * ── The cost, and where it is paid ────────────────────────────────────────────
 * A layout is not given the URL's search parameters, so it cannot filter. The
 * initial load below is therefore unfiltered, and `RecordRail` — a client
 * component — reads the filters itself and refetches from `/api/records` when
 * they change. Arriving directly on a filtered URL shows the unfiltered list
 * for the moment that fetch takes.
 *
 * That is a real trade and it is the right way round: filtering is occasional
 * and deliberate, opening a record is constant.
 *
 * ── Gutters and width ─────────────────────────────────────────────────────────
 * Narrower gutters and a wider container than the single-column screens. The
 * list occupies the left side, so the page margin that reads as breathing room
 * around a centred column reads as wasted space here — and a narrow container
 * pushes the list inward toward the middle rather than letting it sit out left.
 */
export default async function ReflectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const rail = await loadRail(session.userId!, {});

  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      {/* Full width and left-aligned, deliberately.
          It was centred inside a 1440px cap, which on a wide screen pushed the
          record list away from the left edge and into the middle of the window
          while the wordmark above it stayed put. Nothing lined up with anything.
          Now the row starts on the same 20px edge as the nav, and the main view
          takes whatever is left. */}
      <div className="flex min-h-0 flex-1 px-5 pt-5">
        <div className="flex w-full flex-col gap-8 pb-14 lg:flex-row lg:items-start lg:gap-7">
          <RecordRail
            initial={{
              records: rail.records,
              categories: rail.categories,
              total: rail.total,
              capped: rail.capped,
            }}
          />

          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </PageBg>
  );
}
