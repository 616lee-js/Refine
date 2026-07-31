import Link from "next/link";
import { randomUUID } from "crypto";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog, questionnaireResponses } from "@/lib/db/schema";
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

/**
 * Mirror — Memory, and Trends once there is anything to plot.
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

export const dynamic = "force-dynamic";

type Tab = "memory" | "trends";

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

  const tab: Tab = rawTab === "trends" && trendsAvailable ? "trends" : "memory";

  let trends: Trends | null = null;
  if (tab === "trends") {
    trends = await loadTrends(userId);
  }

  return (
    <PageBg>
      <TopNav active="mirror" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-16" style={{ maxWidth: 900 }}>
          <div
            className={trendsAvailable ? "" : "pb-5"}
            style={
              trendsAvailable
                ? undefined
                : { borderBottom: "1px solid var(--rf-border)" }
            }
          >
            <Eyebrow accent>Mirror</Eyebrow>
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
              What Refine has of you
            </h1>
            <p
              className="max-w-[480px]"
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--rf-text-3)",
              }}
            >
              Everything here came from your own writing and check-ins. Confirm
              it, correct it, or take it out.
            </p>
          </div>

          {trendsAvailable && (
            <nav
              className="mt-[18px] flex gap-[26px]"
              style={{ borderBottom: "1px solid var(--rf-border)" }}
            >
              {(
                [
                  ["memory", "Memory"],
                  ["trends", "Trends"],
                ] as const
              ).map(([key, label]) => {
                const on = tab === key;
                return (
                  <Link
                    key={key}
                    href={key === "memory" ? "/mirror" : "/mirror?tab=trends"}
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
            {tab === "trends" && trends ? (
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
