import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isAdminUserId } from "@/lib/auth/admin";

/**
 * Admin entry points in the header — visible only to an admin.
 *
 * ── Genuinely gated, not merely hidden ────────────────────────────────────────
 * This runs the SAME check that protects the routes themselves
 * (`isAdminUserId`, backed only by ADMIN_USER_IDS, fail-closed when unset). A
 * non-admin does not receive markup with `display: none` on it; the component
 * returns null and nothing about admin reaches the response.
 *
 * That is a defence-in-depth measure, not the defence. The real protection is
 * still `requireAdmin()` inside every admin page and every admin server action —
 * see the route-protection section of CLAUDE.md. Hiding a link protects nothing
 * on its own; the link is hidden because showing a dead-end 404 to everyone is
 * poor product, not because hiding it is security.
 *
 * ── Why this is a server component passed as a prop ───────────────────────────
 * TopNav is rendered inside client components on four screens, so it cannot
 * call `getSession()` itself. Every server page passes `<AdminNav />` into
 * TopNav's `admin` slot instead; the client pages take it as a prop from their
 * server parent. A page that forgets simply shows no admin link, which is the
 * safe direction to fail.
 *
 * ── Adding more admin links ───────────────────────────────────────────────────
 * Append to LINKS. Anything added here needs its own `requireAdmin()` at the
 * route — this list grants nothing.
 */

const LINKS: { href: string; label: string }[] = [
  { href: "/admin/safety-log", label: "Safety log" },
  { href: "/admin/feedback", label: "Feedback" },
];

export async function AdminNav({ active = false }: { active?: boolean } = {}) {
  const session = await getSession();
  if (!session.userId || !isAdminUserId(session.userId)) return null;

  return (
    <div
      className="flex items-center gap-[10px] rounded-full"
      style={{
        padding: "4px 11px 4px 9px",
        // Deliberately not the accent: admin context must not read as part of
        // the reflective surface. A cool grey against a warm paper page is the
        // clearest available "you are somewhere else".
        background: active ? "var(--rf-admin)" : "var(--rf-admin-soft)",
        boxShadow: active ? "none" : "inset 0 0 0 1px var(--rf-admin-border)",
      }}
    >
      <span
        className="font-mono uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.16em",
          color: active ? "var(--rf-paper)" : "var(--rf-admin)",
          opacity: active ? 0.75 : 1,
        }}
      >
        Admin
      </span>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="transition-opacity hover:opacity-70"
          style={{
            fontSize: "12.5px",
            color: active ? "var(--rf-paper)" : "var(--rf-admin)",
          }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
