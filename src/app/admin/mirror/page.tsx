import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { mirrorReviews } from "@/lib/db/schema";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import {
  MIRROR_REVIEW_INTERVAL_DAYS,
  getNumberSetting,
} from "@/lib/settings";
import {
  DEFAULT_INTERVAL_DAYS,
  PROMPT_UNWRITTEN,
  PROMPT_VERSION,
  accountsWithEntries,
} from "@/lib/mirror/review";
import { MirrorControls } from "./mirror-controls";

/**
 * Mirror's report — the controls that have no home on a user-facing page.
 *
 * Two things live here and nothing else: how often reports are produced, and a
 * way to produce them now rather than waiting a fortnight.
 *
 * ── It shows no report content ────────────────────────────────────────────────
 * Deliberately. A report is Refine's account of one person, written for them,
 * and reading someone else's is not needed to know whether the mechanism works.
 * Counts and timestamps answer that. This page therefore decrypts nothing and
 * writes no access-log row — unlike the summary evals page, which cannot do its
 * job without showing content.
 *
 * ── The controls are a client component calling routes ────────────────────────
 * Not server actions. See ./mirror-controls.tsx: a run is minutes long, and a
 * server action gave no feedback and was killed by the default function
 * timeout, which looked exactly like the page hanging.
 */

// requireAdmin() forces dynamic rendering via cookies(), but stated explicitly
// so protection never depends on that as a side effect. See CLAUDE.md.
export const dynamic = "force-dynamic";

export default async function AdminMirrorPage() {
  // Gate BEFORE any query runs.
  await requireAdmin();

  const [intervalDays, rows, accounts] = await Promise.all([
    getNumberSetting(MIRROR_REVIEW_INTERVAL_DAYS, DEFAULT_INTERVAL_DAYS),
    db
      .select({
        userId: mirrorReviews.userId,
        n: sql<number>`count(*)::int`,
        last: sql<Date>`max(${mirrorReviews.createdAt})`,
      })
      .from(mirrorReviews)
      .groupBy(mirrorReviews.userId),
    accountsWithEntries(),
  ]);

  const total = rows.reduce((n, r) => n + r.n, 0);
  const byUser = new Map(rows.map((r) => [r.userId, r]));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "27px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
          }}
        >
          Mirror reports
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
        >
          {total} {total === 1 ? "report" : "reports"} across {rows.length}{" "}
          {rows.length === 1 ? "account" : "accounts"}. No report content is
          shown here.
        </p>
      </div>

      {/* Whether the thing can run at all. Stated first because every other
          control on this page is meaningless while it cannot. */}
      <Sheet className="mb-6 px-5 py-4">
        <Eyebrow size={9.5}>Instructions</Eyebrow>
        {PROMPT_UNWRITTEN ? (
          <>
            <p
              className="mt-2"
              style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--color-error)" }}
            >
              Not written. Reports cannot run.
            </p>
            <p
              className="mt-1"
              style={{ fontSize: "12px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
            >
              The file at <code>src/lib/layer2/memory-extraction.md</code> holds
              no instructions, so nothing is sent to Claude and no report is
              produced. Writing a real version line in its header is what
              switches reports on.
            </p>
          </>
        ) : (
          <p
            className="mt-2"
            style={{ fontSize: "13px", color: "var(--rf-text-2)" }}
          >
            Written — version{" "}
            <span className="font-mono" style={{ fontSize: "12px" }}>
              {PROMPT_VERSION}
            </span>
          </p>
        )}
      </Sheet>

      {/* Per account, so the effect of a run is visible rather than left in a
          server log. Prefixes only: enough to tell rows apart. */}
      <Sheet className="mb-6 px-5 py-4">
        <Eyebrow size={9.5}>Accounts</Eyebrow>
        <div className="mt-3 overflow-x-auto">
          <table style={{ fontSize: "12px", width: "100%" }}>
            <thead>
              <tr style={{ color: "var(--rf-text-4)" }}>
                <th className="pb-1 pr-4 text-left font-normal">Account</th>
                <th className="pb-1 pr-4 text-right font-normal">Reports</th>
                <th className="pb-1 text-left font-normal">Latest</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((id) => {
                const r = byUser.get(id);
                return (
                  <tr key={id} style={{ borderTop: "1px solid var(--rf-rule)" }}>
                    <td
                      className="py-[6px] pr-4 font-mono"
                      style={{ fontSize: "11px", color: "var(--rf-text-2)" }}
                    >
                      {id.slice(0, 8)}
                    </td>
                    <td className="py-[6px] pr-4 text-right">{r?.n ?? 0}</td>
                    <td className="py-[6px]" style={{ color: "var(--rf-text-4)" }}>
                      {r?.last
                        ? new Date(r.last).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "none yet"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sheet>

      <MirrorControls
        initialDays={intervalDays}
        accounts={accounts.length}
        disabled={PROMPT_UNWRITTEN}
      />
    </main>
  );
}
