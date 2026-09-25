import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalEntrySummaries,
  mirrorReviews,
  questionnaireResponses,
  userMemory,
  userProfiles,
} from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { getAnthropicApiKey } from "@/lib/env";
import { promptVersion } from "@/lib/safety/prompt-version";
import { authoritativeSummary } from "@/lib/summaries/read";
import { buildTrends, type DecryptedResponse } from "@/lib/trends";
import type { Answers } from "@/lib/questionnaires";
import {
  MIRROR_REVIEW_INTERVAL_DAYS,
  getNumberSetting,
} from "@/lib/settings";

// Bundled at build time, not read from disk — see next.config.ts.
import extractionPrompt from "@/lib/layer2/memory-extraction.md";

import { authoritativeReport } from "./read";
import type { CheckinLines, RawReport } from "./types";

/**
 * Mirror's report.
 *
 * ── What it is ────────────────────────────────────────────────────────────────
 * Every fortnight, read back across someone's writing and produce a report
 * describing what recurs and what has shifted — something they read, not a list
 * they sort. Each run rewrites the running whole-picture report and leaves a
 * short note about that window, which is what the history is made of.
 *
 * **Nothing is written into Memory.** An earlier direction had each run drop
 * facts and threads there for one-by-one approval; that was dropped 2026-09-24.
 * Memory holds what the person typed, and nothing else.
 *
 * ── What it reads ─────────────────────────────────────────────────────────────
 * Summaries of everything written, the full text of entries since the last run,
 * the check-in numbers as Trends states them, the facts and threads the person
 * has confirmed in Memory, their profile, and what previous reports said.
 *
 * ── Numbers are not the model's to describe ───────────────────────────────────
 * Check-in figures reach the report as the exact strings Trends puts on its
 * charts — see `checkinLines()`. The model is shown them so it knows what they
 * are. Only its instructions can stop it restating one in its own words; no
 * code here can. Said plainly because it is the one place the separation
 * between templated numbers and written prose rests on wording rather than
 * structure.
 *
 * ── It does not run without a prompt ──────────────────────────────────────────
 * See PROMPT_UNWRITTEN. A report worded by nobody, about a real person, is
 * worse than no report.
 */

const MODEL = "claude-sonnet-5";

export const PROMPT_VERSION = promptVersion(extractionPrompt);

/**
 * True while the prompt is still a placeholder.
 *
 * The placeholder's header reads UNWRITTEN, so writing a real version line is
 * the single action that switches reports on. No second flag to remember.
 */
export const PROMPT_UNWRITTEN = PROMPT_VERSION === "UNWRITTEN";

/** Fortnightly, per the product owner. Changeable without a deploy. */
export const DEFAULT_INTERVAL_DAYS = 14;

/** Guards the long view against unbounded growth years from now. */
const MAX_SUMMARIES = 200;
/** One pathological paste must not run up an unbounded bill. */
const MAX_ENTRY_CHARS = 20_000;
/** Users processed per run. Bounded to fit inside the function's maxDuration. */
export const REVIEW_BATCH_SIZE = 5;
/** Previous reports shown to the run, so it does not repeat itself. */
const PRIOR_REPORTS = 6;

export class ReviewError extends Error {}

/** A user is due when they have written since their last report, long enough ago. */
async function usersDue(intervalDays: number, limit: number) {
  const cutoff = new Date(Date.now() - intervalDays * 86_400_000);

  /*
   * Derived rather than stored, like the summariser queue: a run that dies
   * halfway leaves the work due instead of leaving a flag to reset.
   */
  const last = db
    .select({
      userId: mirrorReviews.userId,
      lastAt: sql<Date>`max(${mirrorReviews.createdAt})`.as("last_at"),
      lastEnd: sql<Date>`max(${mirrorReviews.windowEnd})`.as("last_end"),
    })
    .from(mirrorReviews)
    .groupBy(mirrorReviews.userId)
    .as("last_review");

  const rows = await db
    .select({
      userId: journalEntries.userId,
      lastAt: last.lastAt,
      lastEnd: last.lastEnd,
      newest: sql<Date>`max(${journalEntries.completedAt})`,
    })
    .from(journalEntries)
    .leftJoin(last, eq(last.userId, journalEntries.userId))
    .where(
      and(
        isNotNull(journalEntries.completedAt),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    )
    .groupBy(journalEntries.userId, last.lastAt, last.lastEnd)
    .limit(limit);

  return rows.filter((r) => {
    if (!r.lastAt) return true;
    if (r.lastAt > cutoff) return false;
    // Due, but nothing new written: a report on an empty fortnight says
    // nothing and still costs a call. Skipped.
    return r.lastEnd === null || r.newest > r.lastEnd;
  });
}

/**
 * Check-in figures, as the exact strings Trends puts on its charts.
 *
 * Built through `buildTrends()` rather than recomputed, so the report and the
 * charts cannot drift apart — a median stated one way in the report and another
 * on the chart would be a bug nobody would catch for months.
 */
async function checkinLines(userId: string): Promise<CheckinLines> {
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
      decrypted.push({ slug: row.slug, completedAt: row.completedAt, answers, total });
    } catch {
      // One unreadable response must not stop the report.
    }
  }

  if (decrypted.length === 0) return [];

  const trends = buildTrends(decrypted);
  const lines = trends.cards.map((c) => `${c.label} — ${c.meta}`);
  if (trends.plainly) lines.push(trends.plainly);
  return lines;
}

/** Everything the model is shown, assembled from what is already stored. */
async function gather(userId: string, since: Date | null) {
  const base = [
    eq(journalEntries.userId, userId),
    isNotNull(journalEntries.completedAt),
    isNull(journalEntries.deletedAt),
    isNull(journalEntries.purgedAt),
  ];

  const summaryRows = await db
    .select({
      completedAt: journalEntries.completedAt,
      encryptedContent: journalEntrySummaries.encryptedContent,
      encryptedUserContent: journalEntrySummaries.encryptedUserContent,
      userEditedAt: journalEntrySummaries.userEditedAt,
      generatedAt: journalEntrySummaries.generatedAt,
      generationVersion: journalEntrySummaries.generationVersion,
    })
    .from(journalEntrySummaries)
    .innerJoin(
      journalEntries,
      eq(journalEntries.id, journalEntrySummaries.journalEntryId)
    )
    .where(and(...base))
    .orderBy(desc(journalEntries.completedAt))
    .limit(MAX_SUMMARIES);

  const summaries: string[] = [];
  for (const row of summaryRows) {
    try {
      // Through authoritativeSummary: a summary the writer corrected is read as
      // they corrected it, never as the superseded original.
      const s = authoritativeSummary(row).summary;
      const date = row.completedAt?.toISOString().slice(0, 10) ?? "undated";
      summaries.push(
        [
          `${date}: ${s.summary}`,
          s.topics.length ? `  categories: ${s.topics.join(", ")}` : null,
          s.people.length ? `  people: ${s.people.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch {
      // Left out rather than fatal.
    }
  }

  const recentRows = await db
    .select({
      id: journalEntries.id,
      completedAt: journalEntries.completedAt,
      encryptedBody: journalEntries.encryptedBody,
    })
    .from(journalEntries)
    .where(
      and(...base, since ? gt(journalEntries.completedAt, since) : undefined)
    )
    .orderBy(asc(journalEntries.completedAt));

  const recent: { id: string; date: string; body: string }[] = [];
  for (const row of recentRows) {
    if (!row.encryptedBody) continue;
    try {
      recent.push({
        id: row.id,
        date: row.completedAt?.toISOString().slice(0, 10) ?? "undated",
        body: decrypt(row.encryptedBody).slice(0, MAX_ENTRY_CHARS),
      });
    } catch {
      // Left out rather than fatal.
    }
  }

  /*
   * Confirmed Memory only.
   *
   * `last_confirmed_at` set is what separates something the person stands
   * behind from anything else. It also carries the kind, which matters for
   * `diagnostic_context`: a confirmed entry there is a deliberate statement
   * about themselves, not an inference drawn from a paragraph of prose.
   */
  const memoryRows = await db
    .select({ kind: userMemory.kind, encryptedContent: userMemory.encryptedContent })
    .from(userMemory)
    .where(
      and(
        eq(userMemory.userId, userId),
        eq(userMemory.isActive, true),
        isNotNull(userMemory.lastConfirmedAt)
      )
    );

  const memory: string[] = [];
  for (const row of memoryRows) {
    try {
      memory.push(`${row.kind}: ${decrypt(row.encryptedContent)}`);
    } catch {
      // Left out rather than fatal.
    }
  }

  const [profileRow] = await db
    .select({ encryptedContent: userProfiles.encryptedContent })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  let profile = "";
  if (profileRow?.encryptedContent) {
    try {
      const p = JSON.parse(decrypt(profileRow.encryptedContent)) as Record<
        string,
        string
      >;
      profile = ["tendencies", "goals", "background"]
        .map((k) => (p[k]?.trim() ? `${k}: ${p[k].trim()}` : null))
        .filter(Boolean)
        .join("\n");
    } catch {
      // Left out rather than fatal.
    }
  }

  return { summaries, recent, memory, profile };
}

/** What previous reports said, so this run does not repeat itself. */
async function priorReports(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      encryptedReport: mirrorReviews.encryptedReport,
      encryptedUserReport: mirrorReviews.encryptedUserReport,
      userEditedAt: mirrorReviews.userEditedAt,
      encryptedPeriodNote: mirrorReviews.encryptedPeriodNote,
      createdAt: mirrorReviews.createdAt,
    })
    .from(mirrorReviews)
    .where(eq(mirrorReviews.userId, userId))
    .orderBy(desc(mirrorReviews.createdAt))
    .limit(PRIOR_REPORTS);

  const out: string[] = [];
  for (const row of rows) {
    try {
      // Through the resolver: where the person rewrote a report, the rewrite is
      // what the next run builds on. Showing it the superseded version would
      // rebuild an account they had already corrected.
      const r = authoritativeReport(row);
      out.push(`${row.createdAt.toISOString().slice(0, 10)}: ${r.report}`);
    } catch {
      // Unreadable history degrades the run; it does not stop it.
    }
  }
  return out;
}

/**
 * Parses the model's reply.
 *
 * Throws rather than salvaging. A half-parsed report would be shown to someone
 * as Refine's account of them.
 */
export function parseReport(raw: string): RawReport {
  let obj: unknown;
  try {
    obj = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ReviewError("Report reply was not JSON");
  }

  const { report, periodNote } = obj as {
    report?: unknown;
    periodNote?: unknown;
  };

  if (typeof report !== "string" || !report.trim()) {
    throw new ReviewError("Report reply was missing the report");
  }
  if (typeof periodNote !== "string" || !periodNote.trim()) {
    throw new ReviewError("Report reply was missing the period note");
  }

  return { report: report.trim(), periodNote: periodNote.trim() };
}

/** Runs one person's report and stores it. Returns whether one was written. */
export async function reviewUser(userId: string): Promise<boolean> {
  if (PROMPT_UNWRITTEN) {
    throw new ReviewError(
      "The Mirror report prompt has not been written — see src/lib/layer2/memory-extraction.md"
    );
  }

  const [last] = await db
    .select({ windowEnd: mirrorReviews.windowEnd })
    .from(mirrorReviews)
    .where(eq(mirrorReviews.userId, userId))
    .orderBy(desc(mirrorReviews.createdAt))
    .limit(1);

  const since = last?.windowEnd ?? null;
  const windowEnd = new Date();

  const { summaries, recent, memory, profile } = await gather(userId, since);

  // Nothing written since the last run: no call, no record, nothing charged.
  if (recent.length === 0) return false;

  const [checkins, prior] = await Promise.all([
    checkinLines(userId),
    priorReports(userId),
  ]);

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: extractionPrompt,
    messages: [
      {
        role: "user",
        content: [
          "## What they have told Refine about themselves",
          profile || "(nothing)",
          "",
          "## Confirmed in their Mirror",
          memory.join("\n") || "(nothing)",
          "",
          "## Summaries of everything written so far",
          summaries.join("\n\n") || "(none)",
          "",
          "## Entries written since the last report, in full",
          recent.map((r) => `### ${r.date}\n${r.body}`).join("\n\n"),
          "",
          "## Check-in figures — stated wording, do not restate in your own words",
          checkins.join("\n") || "(none)",
          "",
          "## What previous reports said",
          prior.join("\n\n") || "(none)",
        ].join("\n"),
      },
    ],
  });

  const raw =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = parseReport(raw);

  /*
   * The check-in lines are appended verbatim rather than left to the model, so
   * what the report says about a number is the same string the chart shows.
   */
  const reportText = checkins.length
    ? `${parsed.report}\n\n${checkins.join("\n")}`
    : parsed.report;

  await db.insert(mirrorReviews).values({
    id: randomUUID(),
    userId,
    windowStart: since ?? new Date(0),
    windowEnd,
    entriesRead: recent.length,
    encryptedReport: encrypt(reportText),
    encryptedPeriodNote: encrypt(parsed.periodNote),
    modelVersion: PROMPT_VERSION,
    createdAt: new Date(),
  });

  return true;
}

/**
 * Runs whoever is due. Called from the nightly job.
 *
 * One person failing must not stop the rest — otherwise one bad reply leaves
 * everybody behind them unreported indefinitely. Logged without content.
 */
export async function runMirrorReviews(limit = REVIEW_BATCH_SIZE) {
  if (PROMPT_UNWRITTEN) {
    return { skipped: "prompt-unwritten" as const, reviewed: 0, failed: 0 };
  }

  const intervalDays = await getNumberSetting(
    MIRROR_REVIEW_INTERVAL_DAYS,
    DEFAULT_INTERVAL_DAYS
  );

  const due = await usersDue(intervalDays, limit);

  let reviewed = 0;
  let failed = 0;

  for (const { userId } of due) {
    try {
      if (await reviewUser(userId)) reviewed++;
    } catch (err) {
      failed++;
      console.error(
        `mirror report failed for user ${userId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { due: due.length, reviewed, failed, intervalDays };
}
