import Link from "next/link";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, questionnaireResponses } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getQuestionnaire } from "@/lib/questionnaires";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";

/**
 * The archive — every record, both shapes, newest first.
 *
 * ── Titles, not excerpts ──────────────────────────────────────────────────────
 * Rows show a date and, where the user set one, a title. There is deliberately
 * **no excerpt**. Deriving one means decrypting every entry on every page view,
 * and each of those is a deliberate decryption that `content_access_log` exists
 * to record — a hundred rows would put a hundred audit entries on the board for
 * a single glance at a list. That does not just cost writes; it buries the log
 * in noise it was never meant to carry.
 *
 * Titles are a decryption too, but a different act: one short field the user
 * wrote *as* a label, chosen for this purpose, present only where they chose it.
 */

type Filter = "all" | "open" | "framework" | "checkin";

type Row = {
  id: string;
  href: string;
  at: Date;
  title: string | null;
  kind: Exclude<Filter, "all">;
  kindLabel: string;
  draft: boolean;
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Writing" },
  { key: "framework", label: "Framework" },
  { key: "checkin", label: "Check-ins" },
];

export default async function ReflectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: raw } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === raw)
    ? (raw as Filter)
    : "all";

  const authSession = await getSession();
  const userId = authSession.userId!;

  // Trashed and purged rows are excluded from both queries. `deleted_at` covers
  // both, since purge leaves it set — but `purged_at` is checked explicitly so
  // the intent survives any future change to that.
  const [entries, responses] = await Promise.all([
    db
      .select({
        id: journalEntries.id,
        createdAt: journalEntries.createdAt,
        updatedAt: journalEntries.updatedAt,
        completedAt: journalEntries.completedAt,
        encryptedTitle: journalEntries.encryptedTitle,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
          isNull(journalEntries.purgedAt)
        )
      )
      .orderBy(desc(journalEntries.updatedAt)),

    db
      .select({
        id: questionnaireResponses.id,
        slug: questionnaireResponses.questionnaireSlug,
        createdAt: questionnaireResponses.createdAt,
        completedAt: questionnaireResponses.completedAt,
      })
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.userId, userId),
          // Unlike entries, an unfinished questionnaire is not listed. A drafted
          // GAD-7 is a half-answered form, not a piece of writing to come back
          // to — surfacing it invites completing it days later, which would make
          // the recall window meaningless.
          isNotNull(questionnaireResponses.completedAt),
          isNull(questionnaireResponses.deletedAt),
          isNull(questionnaireResponses.purgedAt)
        )
      )
      .orderBy(desc(questionnaireResponses.completedAt)),
  ]);

  const rows: Row[] = [
    ...entries.map((e): Row => {
      let title: string | null = null;
      if (e.encryptedTitle) {
        try {
          title = decrypt(e.encryptedTitle);
        } catch {
          // A title that will not decrypt is not worth failing a whole list
          // over. The row still opens, and the read view reports the problem
          // properly when the body fails too.
          title = null;
        }
      }
      return {
        id: e.id,
        href: e.completedAt ? `/reflections/${e.id}` : `/reflection/${e.id}`,
        at: e.completedAt ?? e.updatedAt,
        title,
        kind: "open",
        kindLabel: "Writing",
        draft: !e.completedAt,
      };
    }),
    ...responses.map((r): Row => {
      const q = getQuestionnaire(r.slug);
      const tracker = q?.kind === "tracker";
      return {
        id: r.id,
        href: tracker ? `/checkin/${r.id}` : `/framework/${r.id}`,
        at: r.completedAt ?? r.createdAt,
        title: q?.title ?? r.slug,
        kind: tracker ? "checkin" : "framework",
        kindLabel: q?.shortName ?? r.slug,
        draft: false,
      };
    }),
  ]
    .filter((r) => filter === "all" || r.kind === filter)
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const total = entries.length + responses.length;
  const earliest = [...entries, ...responses]
    .map((r) => r.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <PageBg>
      <TopNav active="reflections" />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 700 }}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-[14px]">
            <div>
              <Eyebrow>
                {total} {total === 1 ? "record" : "records"}
                {earliest &&
                  ` · since ${earliest.toLocaleDateString(undefined, {
                    month: "long",
                  })}`}
              </Eyebrow>
              <h1
                className="mt-[9px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "30px",
                  fontWeight: 380,
                  letterSpacing: "-0.02em",
                  color: "var(--rf-text)",
                }}
              >
                Everything you&apos;ve written
              </h1>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Link
                    key={f.key}
                    href={f.key === "all" ? "/reflections" : `/reflections?filter=${f.key}`}
                    aria-current={on ? "page" : undefined}
                    className="rounded-full transition-colors"
                    style={{
                      padding: "6px 13px",
                      fontSize: "12.5px",
                      color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                      background: on ? "var(--rf-text)" : "transparent",
                      boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {rows.length === 0 ? (
            <Sheet className="px-8 py-14 text-center">
              <p style={{ fontSize: "14px", lineHeight: 1.9, color: "var(--rf-text-3)" }}>
                {filter === "all"
                  ? "Nothing here yet."
                  : "Nothing of this kind yet."}
                <br />
                <Link
                  href="/"
                  className="underline underline-offset-[3px]"
                  style={{ color: "var(--rf-text-2)", textDecorationColor: "var(--rf-border-strong)" }}
                >
                  Start something
                </Link>
              </p>
            </Sheet>
          ) : (
            <Sheet className="px-7 pb-5 pt-1">
              {rows.map((r, i) => (
                <Link
                  key={`${r.kind}-${r.id}`}
                  href={r.href}
                  className="grid items-center gap-x-5 gap-y-1 py-[15px] sm:grid-cols-[62px_1fr_auto]"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--rf-rule)" }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "21px",
                        color: "var(--rf-text)",
                      }}
                    >
                      {r.at.getDate()}
                    </span>{" "}
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        color: "var(--rf-text-4)",
                      }}
                    >
                      {r.at.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "17.5px",
                        color: r.kind === "open" ? "var(--rf-text)" : "var(--rf-text-2)",
                      }}
                    >
                      {/* Date fallback: an untitled entry is named by when it
                          happened, which is the only thing knowable about it
                          without opening it. */}
                      {r.title ??
                        r.at.toLocaleDateString(undefined, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                    </p>
                    {r.draft && (
                      <p
                        className="mt-[3px] font-mono uppercase"
                        style={{
                          fontSize: "9.5px",
                          letterSpacing: "0.14em",
                          color: "var(--rf-text-4)",
                        }}
                      >
                        Unfinished
                      </p>
                    )}
                  </div>

                  <span
                    className="inline-flex w-fit items-center rounded-full font-mono uppercase"
                    style={{
                      padding: "4px 9px",
                      fontSize: "9.5px",
                      letterSpacing: "0.12em",
                      color:
                        r.kind === "framework"
                          ? "var(--rf-accent)"
                          : "var(--rf-text-3)",
                      background:
                        r.kind === "framework"
                          ? "var(--rf-accent-soft)"
                          : "transparent",
                      boxShadow:
                        r.kind === "framework"
                          ? "none"
                          : "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    {r.kindLabel}
                  </span>
                </Link>
              ))}
            </Sheet>
          )}
        </div>
      </div>
    </PageBg>
  );
}
