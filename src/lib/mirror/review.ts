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
import { replyText } from "@/lib/model-reply";
import { authoritativeSummary } from "@/lib/summaries/read";
import {
  buildTrends,
  type DecryptedResponse,
  type Trends,
} from "@/lib/trends";
import type { Answers } from "@/lib/questionnaires";
import {
  MIRROR_REVIEW_INTERVAL_DAYS,
  getNumberSetting,
} from "@/lib/settings";

// Bundled at build time, not read from disk — see next.config.ts.
import extractionPrompt from "@/lib/layer2/memory-extraction.md";

import {
  authoritativeReport,
  periodNote,
  serialiseReport,
  type StructuredReport,
} from "./read";
import {
  DOMAIN_FINGERPRINT,
  canonicalDomain,
  domainOrder,
  domainPromptBlock,
} from "./domains";
import type { CheckinLines, RawReport } from "./types";

/**
 * Mirror's report.
 *
 * ── What it is ────────────────────────────────────────────────────────────────
 * Every 14 days by default, read back across someone's writing and produce a report
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

/**
 * The area list, interpolated rather than pasted into the markdown.
 *
 * Built once at module load — the list is static. Same arrangement as the
 * summariser and its categories, so the prompt cannot fall out of step with the
 * code that validates against it.
 */
const SYSTEM_PROMPT = extractionPrompt.replace("{{DOMAINS}}", domainPromptBlock());

/**
 * Recorded against every report.
 *
 * The area fingerprint is folded in because that list lives in TypeScript, not
 * in the markdown. Without it, editing the areas would change what the model is
 * told while leaving the version identical — and the archive would hold two
 * incompatible vintages with no way to tell them apart. Exactly the reason the
 * summariser folds in its category fingerprint.
 */
export const PROMPT_VERSION = `${promptVersion(
  extractionPrompt
)}+${DOMAIN_FINGERPRINT}`;

/**
 * True while the prompt is still a placeholder.
 *
 * The placeholder's header reads UNWRITTEN, so writing a real version line is
 * the single action that switches reports on. No second flag to remember.
 *
 * Compares the prompt's own version, NOT `PROMPT_VERSION` — that now carries the
 * area fingerprint appended, so `=== "UNWRITTEN"` would never match again and
 * this guard would have silently stopped working. The guard is the only thing
 * standing between a placeholder prompt and a report about a real person.
 */
export const PROMPT_UNWRITTEN = promptVersion(extractionPrompt) === "UNWRITTEN";

/** 14 days, per the product owner. Changeable without a deploy. */
export const DEFAULT_INTERVAL_DAYS = 14;

/**
 * The ceiling on summaries, which only a FIRST report can reach.
 *
 * Every later report is bounded by `SUMMARY_PERIODS` instead — see `gather()`.
 * This remains because a first report has no earlier report to carry the older
 * history, so it genuinely does read everything.
 */
export const MAX_SUMMARIES = 200;
/** One pathological paste must not run up an unbounded bill. */
export const MAX_ENTRY_CHARS = 20_000;
/** Users processed per run. Bounded to fit inside the function's maxDuration. */
export const REVIEW_BATCH_SIZE = 5;

/**
 * ── How much of the past a report is given, and why it is this shape ──────────
 * Changed 2026-10-12 at the product owner's direction: *"a Mirror report should
 * only ever view the details of entries during the current time period once, and
 * any viewing of future Mirror reports should refer to that period's report or
 * summaries only."*
 *
 * What it replaces: summaries of every entry ever written, plus the SIX most
 * recent reports in full. Measured on a real account, those two were 31% and 46%
 * of the message, and the second was six regenerations of one narrative — each
 * report is the whole running account rewritten, so reports 2 to 6 were
 * superseded drafts of report 1.
 *
 * What the three numbers below do:
 *
 *   - One full account, because the newest report IS the compression of
 *     everything before it. The prompt requires it to stand alone, which is what
 *     makes it safe to carry forward alone.
 *   - Twelve period notes, because a note says what one period found at the time
 *     in two to four sentences. Twelve is about six months at the 14-day cadence.
 *     That is a guess and nothing validates it until reports have run under it.
 *   - Two reporting periods of entry summaries, so recent detail is still
 *     readable while older detail is reached only through the account above.
 *
 * The result is bounded by writing RATE rather than by how long someone has kept
 * a journal, which was the point.
 *
 * Nothing stored changes. Every past report stays whole in the person's history
 * and the Mirror history screen still shows all of them; this governs only what
 * the prompt is given.
 */
export const PRIOR_FULL_REPORTS = 1;
export const PRIOR_PERIOD_NOTES = 12;
export const SUMMARY_PERIODS = 2;

export class ReviewError extends Error {}

/**
 * A date as `YYYY-MM-DD`, UTC.
 *
 * Every date the model is shown goes through this, so the window boundaries and
 * the per-entry prefixes are the same shape and cannot be read as two different
 * calendars. UTC deliberately: this runs on a server whose timezone is not the
 * writer's, and a date that shifts by one depending on where the function ran is
 * worse than one that is consistently UTC.
 */
function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

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
    // Due, but nothing new written: a report on an empty window says
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

  return trendsToLines(buildTrends(decrypted));
}

/**
 * Trends cards, as the lines the report is given.
 *
 * Exported because `scripts/mirror-run-once.ts` builds the same block and the
 * two must not drift: a figure phrased one way in a scheduled report and another
 * in a test run would make the test run useless for judging the wording.
 *
 * A card contributes its label and its meta line, except the one card whose
 * figures are the point. An instrument read by area has no figure in its meta
 * line — "as answered 9 Oct, every 3 months" is all it says — so its ratings are
 * listed instead. That is also the one place the report can join a figure to a
 * section: the areas a report breaks out into and the areas that instrument asks
 * about are deliberately the same seven. See ./domains.ts.
 */
export function trendsToLines(trends: Trends): CheckinLines {
  const lines = trends.cards.flatMap((c) =>
    c.kind === "domains"
      ? [
          `${c.label} — ${c.reading}, ${c.meta}`,
          ...c.bars.map((b) => `  ${b.label}: ${b.value} out of ${c.max}`),
        ]
      : [`${c.label} — ${c.meta}`]
  );
  if (trends.plainly) lines.push(trends.plainly);
  return lines.map(stripCopyMarker);
}

/**
 * Removes the `[COPY]` draft marker from a Trends string.
 *
 * Those strings are screen copy awaiting the owner's review, and the marker is
 * how unreviewed wording stays visible on screen. But these same strings are
 * appended verbatim to the report text, so the marker was appearing inside
 * something the reader treats as finished — and inside the prompt, where it means
 * nothing to the model.
 *
 * Stripping here rather than editing `lib/trends` keeps the marker doing its job
 * on screen. The wording itself is still the owner's to review; this only stops
 * the scaffolding travelling with it.
 */
function stripCopyMarker(line: string): string {
  return line.replace(/\[COPY\]\s*/g, "");
}

/** Everything the model is shown, assembled from what is already stored. */
async function gather(
  userId: string,
  since: Date | null,
  opts: { intervalDays: number; hasPriorAccount: boolean }
) {
  const base = [
    eq(journalEntries.userId, userId),
    isNotNull(journalEntries.completedAt),
    isNull(journalEntries.deletedAt),
    isNull(journalEntries.purgedAt),
  ];

  /*
   * Summaries reach back two reporting periods, not all the way.
   *
   * Anything older is reached through the account carried over from the last
   * report, which is the whole point of the change: a period's detail is read
   * once, and after that the report about it is what later reports work from.
   *
   * Measured from the interval SETTING rather than a fixed day count, so moving
   * the cadence moves the reach with it — "two reporting periods" has to mean two
   * of whatever a period currently is.
   *
   * ── Except on a first report ──────────────────────────────────────────────
   * With no earlier report there is nothing carrying the older history, so a
   * date bound would produce a report that read four weeks and presented itself
   * as the whole picture. A first report genuinely does read everything, up to
   * MAX_SUMMARIES.
   */
  const summaryCutoff = opts.hasPriorAccount
    ? new Date(
        Date.now() - SUMMARY_PERIODS * opts.intervalDays * 86_400_000
      )
    : null;

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
    .where(
      and(
        ...base,
        summaryCutoff
          ? gt(journalEntries.completedAt, summaryCutoff)
          : undefined
      )
    )
    .orderBy(desc(journalEntries.completedAt))
    .limit(MAX_SUMMARIES);

  const summaries: string[] = [];
  for (const row of summaryRows) {
    try {
      // Through authoritativeSummary: a summary the writer corrected is read as
      // they corrected it, never as the superseded original.
      const s = authoritativeSummary(row).summary;
      const date = row.completedAt ? day(row.completedAt) : "undated";
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
        date: row.completedAt ? day(row.completedAt) : "undated",
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

  /*
   * When the first entry was written, used as the window start on a first report.
   *
   * Queried rather than taken from `recent[0]` so that an entry whose body will
   * not decrypt still counts towards when the record begins. `recent` drops those
   * silently, and a window that starts after the person's first entry because one
   * row failed to decrypt would be wrong in a way nothing would surface.
   */
  const [earliest] = await db
    .select({ completedAt: journalEntries.completedAt })
    .from(journalEntries)
    .where(and(...base))
    .orderBy(asc(journalEntries.completedAt))
    .limit(1);

  return {
    summaries,
    recent,
    memory,
    profile,
    earliestEntryAt: earliest?.completedAt ?? null,
  };
}

/**
 * The history the run is given: one account, carried forward, plus what each
 * earlier period noted at the time.
 *
 * `account` is null only when no report has ever been written for this person.
 * That is also what tells `gather()` it is a first report and may read every
 * summary — see the constants above.
 */
type History = {
  /** The newest report's running account, already flattened for the prompt. */
  account: { date: string; text: string } | null;
  /** Older periods, oldest first, one line each. */
  notes: string[];
};

async function priorReports(userId: string): Promise<History> {
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
    .limit(PRIOR_FULL_REPORTS + PRIOR_PERIOD_NOTES);

  let account: History["account"] = null;
  const notes: string[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      if (i < PRIOR_FULL_REPORTS) {
        // Through the resolver: where the person rewrote a report, the rewrite
        // is what the next run builds on. Carrying the superseded version
        // forward would rebuild an account they had already corrected.
        const r = authoritativeReport(row);
        account = { date: day(row.createdAt), text: accountText(r.report) };
      } else {
        notes.push(`${day(row.createdAt)}: ${periodNote(row)}`);
      }
    } catch {
      // Unreadable history degrades the run; it does not stop it.
    }
  }

  // Oldest first, so the notes read as a sequence rather than a reverse list.
  notes.reverse();
  return { account, notes };
}

/**
 * The carried-over account as text — the prose and the areas, and NOT the
 * figures.
 *
 * `reportToText` appends `report.figures`, which is right for the Mirror screen
 * and wrong here: the figures are the Trends strings as they stood when that
 * report was written, and the run is given the current ones separately with an
 * instruction to repeat them exactly. Carrying the old copies alongside handed
 * the model two versions of the same numbers and no way to tell which was live.
 *
 * `reportToText` is left alone because the UI and the word count both use it.
 */
export function accountText(report: StructuredReport): string {
  return [report.overall, ...report.sections.map((s) => `${s.domain}: ${s.text}`)]
    .filter((p) => p.trim())
    .join("\n\n");
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

  const { overall, sections, periodNote } = obj as {
    overall?: unknown;
    sections?: unknown;
    periodNote?: unknown;
  };

  if (typeof overall !== "string" || !overall.trim()) {
    throw new ReviewError("Report reply was missing the overall account");
  }
  if (typeof periodNote !== "string" || !periodNote.trim()) {
    throw new ReviewError("Report reply was missing the period note");
  }

  /*
   * Sections are filtered, not validated into an error.
   *
   * An unknown area is discarded the way the summariser discards an invented
   * category — the closed list is a guarantee rather than an instruction the
   * model might ignore. Throwing instead would cost a whole report, including a
   * perfectly good overall account, over one mislabelled section.
   *
   * `[]` is explicitly correct: a window with nothing area-specific in it should
   * produce no sections rather than seven thin ones.
   */
  const parsed: { domain: string; text: string }[] = [];
  const seen = new Set<string>();
  if (Array.isArray(sections)) {
    for (const s of sections) {
      if (typeof s !== "object" || s === null) continue;
      const { domain, text } = s as { domain?: unknown; text?: unknown };
      const key = canonicalDomain(domain);
      if (!key || seen.has(key)) continue;
      if (typeof text !== "string" || !text.trim()) continue;
      seen.add(key);
      parsed.push({ domain: key, text: text.trim() });
    }
  }

  // Our order, never the model's — otherwise the same person's reports would
  // reorder their own life between runs for no reason.
  parsed.sort((a, b) => domainOrder(a.domain) - domainOrder(b.domain));

  return { overall: overall.trim(), sections: parsed, periodNote: periodNote.trim() };
}

/**
 * Runs one person's report and stores it. Returns whether one was written.
 *
 * `force` skips the "nothing written since last time" check. The scheduled run
 * never forces — a report on a window in which nobody wrote anything says
 * nothing and still costs a call. Manual runs during the closed beta do force,
 * because otherwise a prompt change cannot be tested twice against the same
 * account without writing a new entry in between.
 */
export async function reviewUser(
  userId: string,
  {
    force = false,
    intervalDays,
  }: { force?: boolean; intervalDays?: number } = {}
): Promise<boolean> {
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

  /*
   * The history comes first, because how far the summaries reach depends on
   * whether there is any.
   *
   * The scheduled run has already read the interval and passes it in rather than
   * querying the same setting once per person in the batch. A manual run reads
   * it, so it cannot silently use a different reach from the real thing.
   */
  const days =
    intervalDays ??
    (await getNumberSetting(
      MIRROR_REVIEW_INTERVAL_DAYS,
      DEFAULT_INTERVAL_DAYS
    ));

  const prior = await priorReports(userId);

  const { summaries, recent, memory, profile, earliestEntryAt } = await gather(
    userId,
    since,
    { intervalDays: days, hasPriorAccount: prior.account !== null }
  );

  /*
   * Where this report's window begins.
   *
   * Was `since ?? new Date(0)`, which on a first report stored the zero point of
   * computer time — 1 Jan 1970 UTC, rendered as "31 Dec 1969" to any viewer west
   * of UTC, in the line above the report and in every history row thereafter.
   *
   * A first report genuinely does cover everything, so its window starts at the
   * first entry. The final fallback is `windowEnd`, giving a zero-length window:
   * only reachable on a forced run for an account with no readable entries, where
   * a window of no length is the honest answer and a 56-year one is not.
   */
  const windowStart = since ?? earliestEntryAt ?? windowEnd;

  // Nothing written since the last run: no call, no record, nothing charged.
  // A forced run continues anyway — the summaries are still the long view, so
  // it can still rewrite the running report even with an empty window.
  if (recent.length === 0 && !force) return false;

  const checkins = await checkinLines(userId);

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const response = await client.messages.create({
    model: MODEL,
    /*
     * ── This is the budget for thinking AND the report, not the report ────────
     * 3000 → 4000 with v3 → 16000 on 2026-10-12, after the owner ran a report by
     * hand and got "Report reply was not JSON".
     *
     * The cause was not the prompt and not the JSON. This model reasons before
     * it answers, and that reasoning is charged against this number. On the
     * owner's own account — 15 summaries, 7 Mirror items, 4 previous reports,
     * 28,600 characters of input — it used the whole 4000 on reasoning and
     * produced **zero characters** of report. The run looked like a parse
     * failure because an empty reply is not valid JSON.
     *
     * A richer account reasons for longer, which is why the other account in the
     * same batch succeeded. The ceiling has to clear the reasoning with the
     * report's own 400–700 words left over.
     *
     * Raising it costs nothing unless it is used: output is billed per token
     * produced, not per token allowed.
     */
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          /*
           * The window and the count, stated.
           *
           * The model used to be sent neither, while the prompt asked it to say
           * how many entries a pattern appears in and over what span. It had no
           * choice but to tally the blocks of text in front of it, which is how a
           * report came to say "twelve entries" when `entriesRead` was ten. The
           * one authoritative count existed but never left the server.
           *
           * Same treatment as the check-in figures below: given, and not to be
           * recomputed.
           */
          "## This report's window — given figures, do not recount",
          `Window begins: ${day(windowStart)}`,
          `Window ends: ${day(windowEnd)}`,
          `Entries written in this window: ${recent.length}`,
          "Use these exact figures when referring to how much this report covers.",
          "",
          "## What they have told Refine about themselves",
          profile || "(nothing)",
          "",
          "## Confirmed in their Mirror",
          memory.join("\n") || "(nothing)",
          "",
          // Each section says how far back it reaches. Without that, everything
          // below reads as though it belonged to the window above, and a figure
          // spanning a year gets described as recent.
          prior.account
            ? `## Summaries of their entries — the last ${SUMMARY_PERIODS * days} days only, not their whole history`
            : "## Summaries of everything written so far — ALL of their history, not this window",
          summaries.join("\n\n") || "(none)",
          "",
          "## Entries written in this window, in full",
          recent.map((r) => `### ${r.date}\n${r.body}`).join("\n\n") || "(none)",
          "",
          "## Check-in figures — ALL of their history. Stated wording, do not restate in your own words",
          checkins.join("\n") || "(none)",
          "",
          /*
           * The history, in two parts, and the split is the whole change.
           *
           * The account is the compression of everything older than the
           * summaries above — the only input that covers the whole record. The
           * notes say what each earlier period found at the time, which is what
           * lets a report say a pattern has recurred without being handed those
           * entries again.
           */
          "## The current account, carried over from the most recent report — everything older than the summaries above lives here",
          prior.account
            ? `${prior.account.date}\n${prior.account.text}`
            : "(none — this is their first report)",
          "",
          "## What each earlier period noted at the time — oldest first",
          prior.notes.join("\n") || "(none)",
        ].join("\n"),
      },
    ],
  });

  /*
   * Say which failure this is, before the parser gets a chance to mislabel it.
   *
   * A reply that ran out of budget is cut off mid-sentence or missing entirely,
   * and the parser can only report that what it got was not JSON — which sends
   * the next person looking at the prompt and the schema, neither of which is
   * the problem. This is the one failure where the fix is a number.
   */
  if (response.stop_reason === "max_tokens") {
    throw new ReviewError(
      `Report ran out of room: the model used all ${response.usage.output_tokens} ` +
        `tokens it was allowed and the report was cut off. Raise max_tokens.`
    );
  }

  // Not content[0] — Sonnet puts a thinking block there. See lib/model-reply.ts.
  const parsed = parseReport(replyText(response));

  /*
   * The check-in lines are carried verbatim rather than left to the model, so
   * what the report says about a number is the same string the chart shows.
   *
   * Their own field now rather than appended to the prose: a sleep median is not
   * a statement about "health", so putting them in an area would be filing a
   * figure under a judgement nobody made.
   */
  const stored: StructuredReport = {
    overall: parsed.overall,
    sections: parsed.sections,
    figures: checkins,
  };

  await db.insert(mirrorReviews).values({
    id: randomUUID(),
    userId,
    windowStart,
    windowEnd,
    entriesRead: recent.length,
    encryptedReport: encrypt(serialiseReport(stored)),
    encryptedPeriodNote: encrypt(parsed.periodNote),
    modelVersion: PROMPT_VERSION,
    createdAt: new Date(),
  });

  return true;
}

/**
 * Every account with at least one finished entry.
 *
 * Used by the admin's manual run, which deliberately ignores both the schedule
 * and who is due. During the closed beta the product owner triggers reports by
 * hand for everyone; the cadence is what takes over when that stops.
 */
export async function accountsWithEntries(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: journalEntries.userId })
    .from(journalEntries)
    .where(
      and(
        isNotNull(journalEntries.completedAt),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    );
  return rows.map((r) => r.userId);
}

/**
 * Produces a report for every account, ignoring the schedule.
 *
 * One account failing must not stop the rest. Returns what happened per
 * account so the admin page can say so rather than leaving the result to the
 * server log.
 */
export async function reviewEveryone(): Promise<{
  ran: number;
  failed: number;
  errors: string[];
}> {
  if (PROMPT_UNWRITTEN) {
    return { ran: 0, failed: 0, errors: ["The instructions have not been written."] };
  }

  const users = await accountsWithEntries();
  let ran = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const userId of users) {
    try {
      if (await reviewUser(userId, { force: true })) ran++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      // Account identified by prefix only. This string is shown on a screen.
      errors.push(`${userId.slice(0, 8)}: ${message}`);
      console.error(`mirror report failed for user ${userId}:`, message);
    }
  }

  return { ran, failed, errors };
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
      // Interval passed down: it decides how far the summaries reach, and it has
      // already been read once for the due check.
      if (await reviewUser(userId, { intervalDays })) reviewed++;
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
