import Link from "next/link";
import { randomUUID } from "crypto";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  mirrorReviews,
  questionnaireResponses,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire, type Answers } from "@/lib/questionnaires";
import {
  buildTrends,
  MIN_LINE_READINGS,
  MIN_MATRIX_DAYS,
  type DecryptedResponse,
  type Trends,
} from "@/lib/trends";
import { PageBg } from "@/components/ui/page-bg";
import { Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { MemoryPanel } from "./memory-panel";
import { TrendsPanel } from "./trends-panel";
import {
  ReportPanel,
  type CurrentReport,
  type ReportPeriod,
} from "./report-panel";
import { authoritativeReport, periodNote } from "@/lib/mirror/read";

/**
 * Mirror — the Report, with Memory and Trends behind it.
 *
 * ── The report leads ──────────────────────────────────────────────────────────
 * Mirror is a report describing what Refine has noticed across someone's writing
 * over time (decided 2026-09-24). Memory and Trends are what it draws on, so
 * they sit behind it rather than beside it.
 *
 * Until the first report exists, Mirror opens on Memory as it always did — an
 * empty report is not worth landing someone on when there is a populated page
 * one tab away.
 *
 * ── Why the tab is a URL parameter ────────────────────────────────────────────
 * Trends decrypts every check-in in the window. If the tab were client state,
 * every visit to Mirror would pay that cost and write an access-log row for a
 * read the user never asked for. As a parameter, the decryption happens only
 * when someone actually opens Trends.
 *
 * ── Why the tab bar can be absent entirely ────────────────────────────────────
 * Trends does not appear until at least one card can be charted. An empty tab
 * teaches people the room is empty: they look once, find nothing, and are not
 * there when it fills. The tab arriving is itself the signal.
 *
 * Availability is decided by COUNTS, which need no decryption. The cards then
 * apply their real thresholds to the decrypted data — a user who logged five
 * check-ins but skipped the sleep field on all of them gets the tab and a
 * gathering-state card, which is honest.
 */

// COPY REVIEW: headings and descriptions, not just controls.
const COPY = {
  eyebrow: "[COPY] Mirror",
  headline: "[COPY] What Refine has of you",
  lede:
    "[COPY] Everything here came from your own writing and check-ins. Confirm it, correct it, or take it out.",
  tabMemory: "[COPY] Memory",
  tabTrends: "[COPY] Trends",
  tabReport: "[COPY] Report",
} as const;

export const dynamic = "force-dynamic";

type Tab = "report" | "memory" | "trends";

export default async function MirrorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const authSession = await getSession();
  const userId = authSession.userId!;

  // Cheap: counts only, no ciphertext read.
  const counts = await db
    .select({
      slug: questionnaireResponses.questionnaireSlug,
      n: count(),
    })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, userId),
        isNotNull(questionnaireResponses.completedAt),
        isNull(questionnaireResponses.deletedAt),
        isNull(questionnaireResponses.purgedAt)
      )
    )
    .groupBy(questionnaireResponses.questionnaireSlug);

  const trendsAvailable = counts.some(({ slug, n }) => {
    const q = getQuestionnaire(slug);
    if (!q) return false;
    // An unverified instrument is not chartable at all, so it cannot be the
    // thing that brings the tab into existence.
    if (q.kind === "likert" && !q.wordingVerified) return false;
    return n >= Math.min(MIN_LINE_READINGS, MIN_MATRIX_DAYS);
  });

  // Cheap: one row, no ciphertext read, just "is there a report at all".
  const [newest] = await db
    .select({ id: mirrorReviews.id })
    .from(mirrorReviews)
    .where(eq(mirrorReviews.userId, userId))
    .orderBy(desc(mirrorReviews.createdAt))
    .limit(1);

  const reportAvailable = Boolean(newest);

  const tab: Tab =
    rawTab === "trends" && trendsAvailable
      ? "trends"
      : rawTab === "memory"
        ? "memory"
        : reportAvailable
          ? "report"
          : "memory";

  let trends: Trends | null = null;
  if (tab === "trends") {
    trends = await loadTrends(userId);
  }

  let report: { current: CurrentReport | null; history: ReportPeriod[] } = {
    current: null,
    history: [],
  };
  if (tab === "report") {
    report = await loadReport(userId);
  }

  return (
    <PageBg>
      <TopNav active="mirror" admin={<AdminNav />} />

      {/* Same frame as the archive. Mirror holds two columns, so it needs the
          width for the same reason — capped at 900 the Facts column could not
          fit a readable line. */}
      <div className="flex min-h-0 flex-1 justify-center px-5 pt-[26px]">
        <div className="w-full pb-16" style={{ maxWidth: 1240 }}>
          <div
            className={trendsAvailable ? "" : "pb-5"}
            style={
              trendsAvailable
                ? undefined
                : { borderBottom: "1px solid var(--rf-border)" }
            }
          >
            <Eyebrow accent>{COPY.eyebrow}</Eyebrow>
            <h1
              className="mb-[6px] mt-2"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "27px",
                fontWeight: 380,
                letterSpacing: "-0.02em",
                color: "var(--rf-text)",
              }}
            >
              {COPY.headline}
            </h1>
            <p
              className="max-w-[480px]"
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--rf-text-3)",
              }}
            >
              {COPY.lede}
            </p>
          </div>

          {(trendsAvailable || reportAvailable) && (
            <nav
              className="mt-[18px] flex gap-[26px]"
              style={{ borderBottom: "1px solid var(--rf-border)" }}
            >
              {(
                [
                  // Each tab appears only once it holds something. A tab
                  // arriving is itself the signal — same rule Trends has always
                  // followed.
                  ...(reportAvailable
                    ? ([["report", COPY.tabReport]] as const)
                    : []),
                  ["memory", COPY.tabMemory],
                  ...(trendsAvailable
                    ? ([["trends", COPY.tabTrends]] as const)
                    : []),
                ] as const
              ).map(([key, label]) => {
                const on = tab === key;
                return (
                  <Link
                    key={key}
                    href={`/mirror?tab=${key}`}
                    aria-current={on ? "page" : undefined}
                    style={{
                      paddingBottom: 11,
                      marginBottom: -1,
                      fontSize: "13.5px",
                      fontWeight: on ? 500 : 400,
                      color: on ? "var(--rf-text)" : "var(--rf-text-3)",
                      borderBottom: `1px solid ${on ? "var(--rf-accent)" : "transparent"}`,
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="pt-[22px]">
            {tab === "report" ? (
              <ReportPanel current={report.current} history={report.history} />
            ) : tab === "trends" && trends ? (
              <TrendsPanel trends={trends} />
            ) : (
              <MemoryPanel />
            )}
          </div>
        </div>
      </div>
    </PageBg>
  );
}

/**
 * Reads and decrypts the responses Trends is built from.
 *
 * ── One audit row, not N ──────────────────────────────────────────────────────
 * Charting is reading, so this is a genuine decryption event and it is logged.
 * But it is ONE deliberate act by the owner of the data, and writing a row per
 * response would put twenty-one entries on the board for a single glance —
 * burying the log in exactly the noise it exists to make visible. The row
 * carries the count instead.
 *
 * `questionnaireResponseId` stays null for the same reason: this access is not
 * about any one response.
 */
/**
 * Reads the current report and the notes from every run before it.
 *
 * ── One audit row, not one per report ─────────────────────────────────────────
 * Opening the report is one deliberate act by the owner of the data. It
 * decrypts the current report and every past period note, so the row carries
 * the count — the same shape Trends and the archive use, for the same reason:
 * a row per record buries the log in the noise it exists to make visible.
 *
 * ── Everything reads through the resolver ─────────────────────────────────────
 * `authoritativeReport()` decides which version counts, so a report the person
 * rewrote is shown as they wrote it. Reading the columns directly here would be
 * a second implementation of that rule, and the one that quietly disagrees.
 *
 * An unreadable row is dropped rather than failing the page: a key problem
 * should cost the history, not the whole of Mirror.
 */
async function loadReport(
  userId: string
): Promise<{ current: CurrentReport | null; history: ReportPeriod[] }> {
  const rows = await db
    .select()
    .from(mirrorReviews)
    .where(eq(mirrorReviews.userId, userId))
    .orderBy(desc(mirrorReviews.createdAt));

  if (rows.length === 0) return { current: null, history: [] };

  let decrypted = 0;
  let current: CurrentReport | null = null;

  const [newest] = rows;
  try {
    const resolved = authoritativeReport(newest);
    decrypted++;
    current = {
      id: newest.id,
      text: resolved.report,
      edited: resolved.source === "user",
      createdAt: newest.createdAt.toISOString(),
      windowStart: newest.windowStart.toISOString(),
      entriesRead: newest.entriesRead,
    };
  } catch (err) {
    console.error(
      `Mirror report decrypt failed for user ${userId}:`,
      err instanceof Error ? err.message : err
    );
  }

  const history: ReportPeriod[] = [];
  for (const row of rows) {
    try {
      history.push({
        id: row.id,
        note: periodNote(row),
        windowStart: row.windowStart.toISOString(),
        windowEnd: row.windowEnd.toISOString(),
      });
      decrypted++;
    } catch {
      // Dropped from the history rather than taking the page down.
    }
  }

  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId,
    context: `mirror_report_view (${decrypted} records read)`,
  });

  return { current, history };
}

async function loadTrends(userId: string): Promise<Trends> {
  const rows = await db
    .select({
      slug: questionnaireResponses.questionnaireSlug,
      completedAt: questionnaireResponses.completedAt,
      encryptedAnswers: questionnaireResponses.encryptedAnswers,
      encryptedScoring: questionnaireResponses.encryptedScoring,
    })
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.userId, userId),
        isNotNull(questionnaireResponses.completedAt),
        isNull(questionnaireResponses.deletedAt),
        isNull(questionnaireResponses.purgedAt)
      )
    );

  const decrypted: DecryptedResponse[] = [];
  let failures = 0;

  for (const row of rows) {
    if (!row.completedAt) continue;
    try {
      const answers = row.encryptedAnswers
        ? ((JSON.parse(decrypt(row.encryptedAnswers)) as { answers?: Answers })
            .answers ?? {})
        : {};
      const total = row.encryptedScoring
        ? ((JSON.parse(decrypt(row.encryptedScoring)) as { total?: number })
            .total ?? null)
        : null;
      decrypted.push({
        slug: row.slug,
        completedAt: row.completedAt,
        answers,
        total,
      });
    } catch {
      // One unreadable response must not take the whole chart down. It is
      // dropped from the series and counted, so a systemic key problem shows up
      // in the logs rather than as a quietly shorter line.
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(
      `Trends: ${failures} of ${rows.length} responses failed to decrypt for user ${userId}`
    );
  }

  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId,
    context: `mirror_trends_view (${decrypted.length} responses read)`,
  });

  return buildTrends(decrypted);
}
