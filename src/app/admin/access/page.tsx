import { requireAdmin } from "@/lib/auth/admin";
import { Eyebrow } from "@/components/ui/sheet";
import {
  countLiveInvites,
  listInviteCodes,
} from "@/lib/auth/invite-admin";
import { AccessControls } from "./access-controls";

/**
 * Getting people in, and getting them back in.
 *
 * ── Why this page exists ──────────────────────────────────────────────────────
 * Invite codes were command-line only: generating one meant a terminal on the
 * machine holding `.env.local`. Password resets did not exist at all. The product
 * owner asked for both from the admin account.
 *
 * The CLI stays and is still the documented path in `docs/refine_operations.md`.
 * It needs no session, which is what makes it the right tool when the thing that
 * is broken is signing in — including the admin's own ability to sign in, which
 * this page cannot help with by construction.
 *
 * ── It shows no account content and no account list ───────────────────────────
 * No journal content, no summaries, no names, and deliberately no list of
 * accounts. Reset codes are looked up by typing the address, the same shape as
 * `npm run invites -- whoami`. A roster of every account's email address on an
 * admin page is a larger exposure than issuing a code needs, so nothing decrypts
 * here and no access-log row is written.
 *
 * ── Dates are formatted on the server ─────────────────────────────────────────
 * Invite dates below, and reset dates in the route. A date formatted in a client
 * component renders one way in the server's HTML and another at hydration, which
 * is the mismatch that took the check-in page down.
 */

// requireAdmin() forces dynamic rendering via cookies(), but stated explicitly so
// protection never depends on that as a side effect. See CLAUDE.md.
export const dynamic = "force-dynamic";

// COPY REVIEW: operational wording for an admin screen, still placeholders.
const COPY = {
  eyebrow: "[COPY] Admin · Access",
  headline: "[COPY] Invites and resets",
  lede: (live: number) =>
    `[COPY] ${live} invite ${live === 1 ? "code" : "codes"} ready to hand out. Refine cannot send email, so both kinds of code are given out by you directly.`,
} as const;

/** `YYYY-MM-DD`, UTC — matching the other admin screens. */
function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export default async function AdminAccessPage() {
  // Gate BEFORE any query runs.
  await requireAdmin();

  const [invites, live] = await Promise.all([
    listInviteCodes(),
    countLiveInvites(),
  ]);

  return (
    <div className="mx-auto w-full px-5 py-9" style={{ maxWidth: 900 }}>
      <Eyebrow>{COPY.eyebrow}</Eyebrow>
      <h1
        className="mb-[8px] mt-[9px]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          fontWeight: 380,
          letterSpacing: "-0.02em",
          color: "var(--rf-text)",
        }}
      >
        {COPY.headline}
      </h1>
      <p
        className="mb-7 max-w-[560px]"
        style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
      >
        {COPY.lede(live)}
      </p>

      <AccessControls
        invites={invites.map((row) => ({
          ...row,
          createdLabel: day(row.createdAt),
          expiresLabel: row.expiresAt ? day(row.expiresAt) : "[COPY] No expiry",
        }))}
      />
    </div>
  );
}
