import { requireAdmin } from "@/lib/auth/admin";
import { PageBg } from "@/components/ui/page-bg";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Shell for everything under /admin.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * /admin/safety-log rendered its own bare header with no navigation, so reaching
 * it was a one-way trip: no way back to the app short of editing the URL. Admin
 * is a view *within* Refine, not a separate application, and it should be
 * possible to leave it the same way you left any other page.
 *
 * Every future page under /admin inherits this automatically — the standard top
 * nav, the Dawn background, and the context bar below. Adding an admin page
 * means adding a page, not re-deriving a shell.
 *
 * ── THIS LAYOUT IS NOT THE AUTHORISATION ──────────────────────────────────────
 * It calls requireAdmin() as defence in depth, and that is ALL it is. The rule in
 * CLAUDE.md stands unchanged and is not softened by this file:
 *
 *   Every page under /admin must call `await requireAdmin()` itself, and every
 *   server action must gate itself separately.
 *
 * A layout does not protect a server action — actions are independently
 * addressable endpoints that do not render through it. Treating a layout check
 * as sufficient is exactly how /admin/safety-log shipped unauthenticated the
 * first time: protection that lives somewhere other than the thing being
 * protected is protection nobody can see missing.
 *
 * The check here is deliberately duplicated, not relocated.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth only. Responds 404 to a non-admin, so the chrome below
  // never renders for one — but see the note above: the page still checks.
  await requireAdmin();

  return (
    <PageBg>
      <TopNav admin={<AdminNav active />} />

      {/* A standing reminder of where you are. Admin surfaces decrypt other
          people's journal content; that should never feel like ordinary
          browsing, and the cool slate is the only non-warm colour in the
          palette precisely so this reads as somewhere else. */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-[10px] sm:px-10"
        style={{
          background: "var(--rf-admin-soft)",
          borderBottom: "1px solid var(--rf-admin-border)",
        }}
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.16em",
            color: "var(--rf-admin)",
          }}
        >
          Admin area
        </span>
        <span
          style={{ fontSize: "11.5px", color: "var(--rf-admin)", opacity: 0.85 }}
        >
          These pages show other people&apos;s content. Every view is recorded.
        </span>
      </div>

      {children}
    </PageBg>
  );
}
