import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { mirrorReviews } from "@/lib/db/schema";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import {
  MIRROR_REVIEW_INTERVAL_DAYS,
  getNumberSetting,
  setNumberSetting,
} from "@/lib/settings";
import {
  DEFAULT_INTERVAL_DAYS,
  PROMPT_UNWRITTEN,
  PROMPT_VERSION,
  accountsWithEntries,
  reviewEveryone,
} from "@/lib/mirror/review";

/**
 * Mirror's report — the controls that have no home on a user-facing page.
 *
 * Two things live here and nothing else: how often reports are produced, and a
 * way to produce one now rather than waiting a fortnight for the nightly job.
 *
 * ── It shows no report content ────────────────────────────────────────────────
 * Deliberately. A report is Refine's account of one person, written for them,
 * and there is no reason to read someone else's to know whether the mechanism
 * works. Counts and timestamps answer that. This page therefore decrypts
 * nothing and writes no access-log row — unlike the summary evals page, which
 * cannot do its job without showing content.
 */

// requireAdmin() forces dynamic rendering via cookies(), but stated explicitly
// so protection never depends on that as a side effect. See CLAUDE.md.
export const dynamic = "force-dynamic";

/** The cadences worth offering. Fortnightly is the product owner's default. */
const CHOICES = [7, 14, 30] as const;

/**
 * Changes how often reports are produced.
 *
 * Gated separately from the page — a server action is its own endpoint and does
 * not render through the page or the layout.
 */
async function setCadence(formData: FormData) {
  "use server";
  await requireAdmin();

  const raw = formData.get("days");
  const days = Number(raw);
  if (!CHOICES.includes(days as (typeof CHOICES)[number])) return;

  await setNumberSetting(MIRROR_REVIEW_INTERVAL_DAYS, days);
  revalidatePath("/admin/mirror");
}

/**
 * Produces a report for every account, now.
 *
 * ── Why this covers everyone, not just the caller ─────────────────────────────
 * The product owner triggers reports by hand throughout the closed beta and
 * judges them across accounts, not only their own. The cadence exists and works;
 * it is what takes over when manual triggering stops. Until then, waiting a
 * fortnight to see whether a wording change helped is not a test loop.
 *
 * It ignores the schedule and the "nothing written since last time" skip, so
 * pressing it twice produces two reports for the same person. That is the point
 * — a prompt change has to be testable against the same writing.
 *
 * It generates reports ABOUT other people and does not show them. Someone
 * opening their Mirror will find a report they did not ask for, which is
 * correct during a beta they consented to and would not be afterwards.
 */
async function runNow() {
  "use server";
  await requireAdmin();

  const result = await reviewEveryone();

  console.log(
    JSON.stringify({ event: "mirror_manual_run", ran: result.ran, failed: result.failed })
  );

  revalidatePath("/admin/mirror");
  revalidatePath("/mirror");
}

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
          {total} {total === 1 ? "report" : "reports"} across{" "}
          {rows.length} {rows.length === 1 ? "account" : "accounts"}. No report
          content is shown here.
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

      <Sheet className="mb-6 px-5 py-4">
        <Eyebrow size={9.5}>How often</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          A report is produced for someone every{" "}
          <strong style={{ color: "var(--rf-text)" }}>{intervalDays} days</strong>
          , and skipped entirely when they have written nothing since the last
          one — no run, no record, nothing charged.
        </p>

        <div className="mt-3 flex flex-wrap gap-[6px]">
          {CHOICES.map((days) => {
            const on = days === intervalDays;
            return (
              <form key={days} action={setCadence}>
                <input type="hidden" name="days" value={days} />
                <button
                  type="submit"
                  className="rounded-full transition-colors"
                  style={{
                    padding: "5px 13px",
                    fontSize: "12px",
                    color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                    background: on ? "var(--rf-text)" : "transparent",
                    boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
                  }}
                >
                  {days} days
                </button>
              </form>
            );
          })}
        </div>
      </Sheet>

      <Sheet className="px-5 py-4">
        <Eyebrow size={9.5}>Run for every account</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          Produces a report for every account with at least one finished entry,
          immediately. It ignores the schedule above and runs even for people who
          have written nothing since their last report, so pressing it twice
          gives the same person two reports.
        </p>
        <p
          className="mt-2"
          style={{ fontSize: "12px", lineHeight: 1.55, color: "var(--rf-text-4)" }}
        >
          These reports are about other people and appear in their Mirror, not
          yours. They can delete them. This is a closed-beta control — the
          schedule is what takes over when it stops being pressed by hand.
        </p>

        {/* Per account, so the result of pressing it is visible rather than
            left in a server log. Prefixes only: enough to tell rows apart. */}
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

        <form action={runNow} className="mt-4">
          <button
            type="submit"
            disabled={PROMPT_UNWRITTEN}
            className="rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              padding: "7px 15px",
              fontSize: "12.5px",
              fontWeight: 500,
              background: "var(--rf-text)",
              color: "var(--rf-paper)",
            }}
          >
            Run for all {accounts.length}{" "}
            {accounts.length === 1 ? "account" : "accounts"}
          </button>
        </form>
      </Sheet>
    </main>
  );
}
