import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
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
  reviewUser,
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
 * Produces a report for the admin's own account, now.
 *
 * Calls `reviewUser` directly rather than the nightly runner, which means it
 * deliberately ignores the cadence — waiting fourteen days to find out whether
 * a change worked is not a test loop.
 *
 * Only ever the caller's own account. Generating a report about someone else on
 * demand is not a thing this page should be able to do.
 */
async function runNow() {
  "use server";
  const adminId = await requireAdmin();

  try {
    await reviewUser(adminId);
  } catch (err) {
    // Surfaced through the page's own state rather than thrown: the most likely
    // cause is the prompt still being unwritten, which is a state, not a crash.
    console.error(
      "manual mirror report failed:",
      err instanceof Error ? err.message : err
    );
  }

  revalidatePath("/admin/mirror");
  revalidatePath("/mirror");
}

export default async function AdminMirrorPage() {
  // Gate BEFORE any query runs.
  const adminId = await requireAdmin();

  const [intervalDays, rows, mine] = await Promise.all([
    getNumberSetting(MIRROR_REVIEW_INTERVAL_DAYS, DEFAULT_INTERVAL_DAYS),
    db
      .select({
        userId: mirrorReviews.userId,
        n: sql<number>`count(*)::int`,
      })
      .from(mirrorReviews)
      .groupBy(mirrorReviews.userId),
    db
      .select({ createdAt: mirrorReviews.createdAt, entriesRead: mirrorReviews.entriesRead })
      .from(mirrorReviews)
      .where(eq(mirrorReviews.userId, adminId))
      .orderBy(desc(mirrorReviews.createdAt))
      .limit(1),
  ]);

  const total = rows.reduce((n, r) => n + r.n, 0);

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
        <Eyebrow size={9.5}>Run one now</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          Produces a report for your own account immediately, ignoring the
          schedule above. It still does nothing if you have written nothing
          since your last one.
        </p>

        {mine[0] ? (
          <p
            className="mt-2"
            style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
          >
            Your last report:{" "}
            {mine[0].createdAt.toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            , covering {mine[0].entriesRead}{" "}
            {mine[0].entriesRead === 1 ? "entry" : "entries"}.
          </p>
        ) : (
          <p
            className="mt-2"
            style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
          >
            You have no reports yet.
          </p>
        )}

        <form action={runNow} className="mt-3">
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
            Run now
          </button>
        </form>
      </Sheet>
    </main>
  );
}
