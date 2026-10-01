import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentAccessLog,
  journalEntries,
  journalEntrySummaries,
  mirrorReviews,
  userMemory,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { authoritativeSummary } from "@/lib/summaries/read";
import { genericSections, type GuidanceItem, type GuidanceSection } from "./guidance";

/**
 * Footholds drawn from a person's own record.
 *
 * ── Built from what is stored, not generated ───────────────────────────────────
 * No model call. Everything here is already in the database because the person
 * wrote it or confirmed it: facts they have kept in their Mirror, the categories
 * and people recurring across recent summaries, and the last report's note about
 * the window it covered. The cost of a foothold should not be an API request every
 * time someone opens a blank page.
 *
 * Having the AI *write* personalised prompts is a separate decision and is
 * deliberately not here — that is new instruction-writing, which working rule 7
 * says is worked through with the product owner rather than drafted alone.
 *
 * ── It never sees the entry ────────────────────────────────────────────────────
 * Takes a user id and nothing else. The sidebar has no prop through which the
 * text being written could reach it, and this function has no parameter for it
 * either. That is structural: a foothold that reacted to the sentence being typed
 * would be the app shaping the articulation as it happens, which the writing
 * surface exists not to do.
 *
 * ── Every personal item says where it came from ───────────────────────────────
 * `sourceLabel` is mandatory in practice for these, and the rail already renders
 * it. A prompt about someone's own life appearing with no provenance reads as the
 * app having decided something about them; "From what you've confirmed in Mirror"
 * makes it theirs.
 *
 * ── Nothing here is a claim ────────────────────────────────────────────────────
 * These name what recurs and stop. No interpretation, no "you seem to be", no
 * suggestion that a recurring category is a problem. Same constraint as the
 * generic content, and it matters more here because the material is specific.
 */

/** Recent summaries read for recurring categories and people. */
const SUMMARY_WINDOW = 12;
/** A category or person must appear this often to be worth naming. */
const MIN_RECURRENCE = 3;
/** At most this many personal footholds, so they cannot bury the practice ones. */
const MAX_PERSONAL = 4;

/**
 * The sections for one person: their own first, then the practice guidance.
 *
 * Theirs leads because it is the part that could not have been written in advance.
 * Returns the generic sections alone for anyone with nothing recorded yet, which
 * is every new account and is not an error state.
 */
export async function guidanceFor(userId: string): Promise<GuidanceSection[]> {
  const personal = await personalItems(userId);
  if (personal.length === 0) return genericSections();

  return [
    {
      id: "yours",
      // COPY REVIEW: placeholder, like the rest of this content.
      title: "[COPY] From your own record",
      items: personal.slice(0, MAX_PERSONAL),
    },
    ...genericSections(),
  ];
}

async function personalItems(userId: string): Promise<GuidanceItem[]> {
  const items: GuidanceItem[] = [];
  let decrypted = 0;

  // ── What they have confirmed in Mirror ──────────────────────────────────────
  // Confirmed only: `lastConfirmedAt` set is what separates something the person
  // stands behind from anything else. Same gate Mirror's report uses.
  const memoryRows = await db
    .select({ kind: userMemory.kind, encryptedContent: userMemory.encryptedContent })
    .from(userMemory)
    .where(
      and(
        eq(userMemory.userId, userId),
        eq(userMemory.isActive, true),
        isNotNull(userMemory.lastConfirmedAt)
      )
    )
    .limit(20);

  const facts: string[] = [];
  for (const row of memoryRows) {
    try {
      const text = decrypt(row.encryptedContent).trim();
      decrypted++;
      if (text) facts.push(text);
    } catch {
      // One unreadable item must not cost the whole rail.
    }
  }

  if (facts.length > 0) {
    // The most recently confirmed, singular. A list of everything they have ever
    // confirmed is their Mirror page, not a foothold.
    const fact = facts[facts.length - 1];
    items.push({
      id: "personal-memory",
      title: "[COPY] Something you've kept",
      body: `[COPY] You have this in your Mirror: "${fact}" — if it is still true, or has stopped being true, that is worth a few lines.`,
      source: "personal",
      sourceLabel: "[COPY] From your Mirror",
    });
  }

  // ── What recurs across recent summaries ─────────────────────────────────────
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
        eq(journalEntries.userId, userId),
        isNotNull(journalEntries.completedAt),
        isNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    )
    .orderBy(desc(journalEntries.completedAt))
    .limit(SUMMARY_WINDOW);

  const categoryCounts = new Map<string, number>();
  const peopleCounts = new Map<string, number>();

  for (const row of summaryRows) {
    try {
      // Through authoritativeSummary: where the writer corrected a summary, the
      // categories counted are the ones they chose, never the superseded ones.
      const s = authoritativeSummary(row).summary;
      decrypted++;
      for (const c of s.topics) {
        categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
      }
      for (const p of s.people) {
        peopleCounts.set(p, (peopleCounts.get(p) ?? 0) + 1);
      }
    } catch {
      // Left out rather than fatal.
    }
  }

  const topCategory = mostCommon(categoryCounts);
  if (topCategory) {
    items.push({
      id: "personal-category",
      title: "[COPY] Something that keeps coming up",
      body: `[COPY] ${topCategory.name} has appeared in ${topCategory.count} of your last ${summaryRows.length} entries. No conclusion in that — but it is there if you want to write about it directly.`,
      source: "personal",
      sourceLabel: "[COPY] From your recent entries",
    });
  }

  const topPerson = mostCommon(peopleCounts);
  if (topPerson) {
    items.push({
      id: "personal-person",
      title: "[COPY] Someone you mention often",
      body: `[COPY] ${topPerson.name} comes up in ${topPerson.count} of your last ${summaryRows.length} entries. What has changed there lately, if anything?`,
      source: "personal",
      sourceLabel: "[COPY] From your recent entries",
    });
  }

  // ── What the last report said about its window ──────────────────────────────
  // The period note rather than the report: the note is about one window and is
  // kept permanently, which makes it the closest thing to an open thread. The
  // report is the running whole and is rewritten each time.
  const [lastReport] = await db
    .select({ encryptedPeriodNote: mirrorReviews.encryptedPeriodNote })
    .from(mirrorReviews)
    .where(eq(mirrorReviews.userId, userId))
    .orderBy(desc(mirrorReviews.createdAt))
    .limit(1);

  if (lastReport?.encryptedPeriodNote) {
    try {
      const note = decrypt(lastReport.encryptedPeriodNote).trim();
      decrypted++;
      if (note) {
        items.push({
          id: "personal-period-note",
          title: "[COPY] Where your last report left off",
          body: `[COPY] ${firstSentence(note)}`,
          source: "personal",
          sourceLabel: "[COPY] From your last Mirror report",
        });
      }
    } catch {
      // Left out rather than fatal.
    }
  }

  /*
   * One row for the whole build, carrying the count.
   *
   * Never one row per record — the same rule the record list and Trends follow.
   * This runs every time a writing surface opens, so a row per decryption would
   * make the audit log mostly footholds and bury the accesses that matter.
   */
  if (decrypted > 0) {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId,
      context: `journal_footholds (${decrypted} records read)`,
    });
  }

  return items;
}

/** The most frequent entry, if it recurs enough to be worth naming. */
function mostCommon(
  counts: Map<string, number>
): { name: string; count: number } | null {
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (count < MIN_RECURRENCE) continue;
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

/**
 * The first sentence of a period note.
 *
 * The whole note is two to four sentences about a window — too much for a
 * foothold, and quoting all of it turns the rail into a second copy of Mirror.
 * Falls back to the whole string where there is no sentence break to find.
 */
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  const first = (match?.[0] ?? text).trim();
  return first.length > 220 ? `${first.slice(0, 217).trimEnd()}…` : first;
}
