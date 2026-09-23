import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, journalEntrySummaries, contentAccessLog } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { PageBg } from "@/components/ui/page-bg";
import { Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { CrisisResourcePanel } from "@/components/ui/crisis-resource-panel";
import {
  authoritativeSummary,
  isStale,
  type ResolvedSummary,
} from "@/lib/summaries/read";
import { EntryTitle } from "./entry-title";
import { ReadBack } from "./read-back";
import { CompletionNotice } from "./completion-notice";
import { RecordRail, type RailView } from "../record-rail";
import { loadRecords, parseFilters } from "../records";

/**
 * Reading back a completed entry.
 *
 * ── The completed state ───────────────────────────────────────────────────────
 * Completing an entry lands here. It is not editable here — editing is the
 * explicit "edit" action, which reopens the writing surface at /reflection/[id]
 * and returns here on save or cancel. An entry is therefore either being
 * written or being read, never both at once.
 *
 * The exception is the title, which is editable in place. See ./entry-title.tsx
 * for why naming belongs to re-reading rather than to finishing.
 *
 * ── Summary first ─────────────────────────────────────────────────────────────
 * "What Refine took from this" sits above the entry (moved 2026-09-21). It is
 * still collapsed by default; whether it should open by default now that it
 * leads the page is the owner's call.
 *
 * ── Resources on arrival ──────────────────────────────────────────────────────
 * The crisis panel renders when arriving from completion (`?completed=1` or
 * `?saved=1`) and the stored tier is 2 or 3 — the same moment it showed on the
 * old in-editor flow. Whether a Tier 2/3 entry should carry its resources on
 * *every* read is a safety-design decision that has not been made; nothing
 * here assumes it.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  edit: "[COPY] Edit entry",
  unfinished: "[COPY] unfinished",
  earlier: "[COPY] ← Earlier",
  later: "[COPY] Later →",
  earliest: "[COPY] Earliest entry",
  latest: "[COPY] Latest entry",
} as const;

/**
 * The entries either side of this one, by date.
 *
 * ── Chronological, not filtered ───────────────────────────────────────────────
 * Deliberately NOT scoped to whatever filter the archive had applied. Reading
 * back is reading a journal: the page before this one is the entry written
 * before it, and a journal does not skip pages because of a search. The archive
 * link keeps the filter; the page turns do not.
 *
 * Two indexed queries rather than loading the list and finding an index. The
 * alternative would decrypt every summary to honour a topic filter, on a page
 * whose job is to show one entry.
 *
 * `completed_at` is the ordering key, so drafts are excluded — an unfinished
 * entry is not a page in the journal yet.
 */
async function neighbours(userId: string, completedAt: Date | null) {
  if (!completedAt) return { earlier: null, later: null };

  const base = [
    eq(journalEntries.userId, userId),
    isNotNull(journalEntries.completedAt),
    isNull(journalEntries.deletedAt),
    isNull(journalEntries.purgedAt),
  ];

  const [earlier, later] = await Promise.all([
    db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(...base, lt(journalEntries.completedAt, completedAt)))
      .orderBy(desc(journalEntries.completedAt))
      .limit(1),
    db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(...base, gt(journalEntries.completedAt, completedAt)))
      .orderBy(asc(journalEntries.completedAt))
      .limit(1),
  ]);

  return { earlier: earlier[0]?.id ?? null, later: later[0]?.id ?? null };
}

export default async function ReflectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    completed?: string;
    saved?: string;
    filter?: string;
    category?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { completed, saved } = sp;
  const arrival: "completed" | "saved" | null =
    completed === "1" ? "completed" : saved === "1" ? "saved" : null;

  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, authSession.userId)
      )
    )
    .limit(1);

  // Ownership is enforced in the query, so a miss is either "not yours" or
  // "doesn't exist" — both 404, which avoids confirming that an id exists.
  if (!entry) notFound();

  // A purged entry has no content to show. Its row only exists so the safety
  // log keeps its reference.
  if (entry.purgedAt) notFound();

  const [summaryRow] = await db
    .select()
    .from(journalEntrySummaries)
    .where(eq(journalEntrySummaries.journalEntryId, id))
    .limit(1);

  let resolved: ResolvedSummary | null = null;
  let summaryUnreadable = false;
  if (summaryRow) {
    try {
      resolved = authoritativeSummary(summaryRow);
    } catch (err) {
      // A summary that will not decrypt must never take down the entry it
      // describes. The entry is the irreplaceable thing; the summary is derived.
      summaryUnreadable = true;
      console.error(
        `Summary decrypt failed for entry ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Audit: one row, not two. Reading the summary is part of the same deliberate
  // act on the same entry — a second row would double the log's volume while
  // recording nothing the first does not already say. Same reasoning as the
  // single row Trends writes. The log records decryptions, not eyeballs: this is
  // written whether or not the disclosure below is expanded, because the
  // decryption genuinely happened server-side.
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    journalEntryId: id,
    context: summaryRow
      ? "journal_entry_detail_view (+summary)"
      : "journal_entry_detail_view",
  });

  let body = "";
  let decryptFailed = false;
  if (entry.encryptedBody) {
    try {
      body = decrypt(entry.encryptedBody);
    } catch (err) {
      decryptFailed = true;
      console.error(
        `Journal entry decrypt failed for ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  let title: string | null = null;
  if (entry.encryptedTitle) {
    try {
      title = decrypt(entry.encryptedTitle);
    } catch {
      title = null;
    }
  }

  const { earlier, later } = await neighbours(
    authSession.userId,
    entry.completedAt
  );

  // The rail, carrying whatever filters the archive had applied. It decrypts
  // its own records and writes its own single audit row — see ../records.ts.
  const { range, ...railFilters } = parseFilters(sp);
  const rail = await loadRecords(authSession.userId, railFilters);
  const railView: RailView = {
    kind: railFilters.kind,
    range,
    from: sp.from ?? null,
    to: sp.to ?? null,
    category: railFilters.category,
    q: railFilters.q,
  };

  const written = entry.completedAt ?? entry.createdAt;
  const dateLong = written.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // No word count (removed 2026-09-21): a count is a target in disguise.

  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div
          className="flex w-full flex-col gap-8 pb-14 lg:flex-row lg:items-start lg:gap-10"
          style={{ maxWidth: 1100 }}
        >
          {/* The same rail as /reflections, with this record selected. */}
          <RecordRail
            records={rail.records}
            categories={rail.categories}
            total={rail.total}
            view={railView}
            selectedId={entry.id}
          />

          <main className="flex min-w-0 flex-1 flex-col">
          {arrival && <CompletionNotice kind={arrival} />}

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-[14px]">
            <div className="min-w-0">
              <Eyebrow>
                {dateLong}
                {" · "}
                {written.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {!entry.completedAt && ` · ${COPY.unfinished}`}
              </Eyebrow>
              <div className="mt-[9px]">
                <EntryTitle
                  entryId={entry.id}
                  initialTitle={title}
                  fallback={dateLong}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/reflection/${entry.id}`}
                className="rounded-full transition-colors"
                style={{
                  padding: "7px 14px",
                  fontSize: "12.5px",
                  color: "var(--rf-text-2)",
                  boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                }}
              >
                {COPY.edit}
              </Link>
            </div>
          </div>

          {/* Summary above the entry, then the entry. One client component so
              text selected in the entry can become a quote in the summary —
              see ./read-back.tsx. `topics` / `people` are flagged for a
              consistency review: the vocabulary drifts entry to entry. */}
          <ReadBack
            body={body}
            decryptFailed={decryptFailed}
            summary={{
              entryId: entry.id,
              summary: resolved?.summary ?? null,
              aiOriginal: resolved?.aiOriginal ?? null,
              source: resolved?.source ?? null,
              generationVersion: summaryRow?.generationVersion ?? null,
              generatedAt: summaryRow?.generatedAt.toISOString() ?? null,
              stale: summaryRow ? isStale(summaryRow, entry.updatedAt) : false,
              unreadable: summaryUnreadable,
            }}
          />

          {arrival && entry.tierClassification !== null && (
            <CrisisResourcePanel tier={entry.tierClassification} />
          )}

          {/* Page turns. Only where the entry is part of the sequence — a draft
              is not yet. Both ends are stated rather than hidden, so reaching
              the first entry reads as arriving somewhere. */}
          {entry.completedAt && (earlier || later) && (
            <nav
              aria-label="Entries either side of this one"
              className="mt-[18px] flex items-center justify-between gap-4 pt-4"
              style={{ borderTop: "1px solid var(--rf-rule)" }}
            >
              {earlier ? (
                <Link
                  href={`/reflections/${earlier}`}
                  rel="prev"
                  className="rounded-full transition-colors"
                  style={{
                    padding: "7px 14px",
                    fontSize: "12.5px",
                    color: "var(--rf-text-2)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                  }}
                >
                  {COPY.earlier}
                </Link>
              ) : (
                <Eyebrow size={9.5}>{COPY.earliest}</Eyebrow>
              )}

              {later ? (
                <Link
                  href={`/reflections/${later}`}
                  rel="next"
                  className="rounded-full transition-colors"
                  style={{
                    padding: "7px 14px",
                    fontSize: "12.5px",
                    color: "var(--rf-text-2)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                  }}
                >
                  {COPY.later}
                </Link>
              ) : (
                <Eyebrow size={9.5}>{COPY.latest}</Eyebrow>
              )}
            </nav>
          )}

          {/* No "back to the archive" link: the archive is the rail, and it is
              on screen. A link back to something already visible is noise. */}
          </main>
        </div>
      </div>
    </PageBg>
  );
}
