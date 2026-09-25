"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { RecordCard, RecordCardList } from "@/components/ui/record-card";
import { TopNav } from "@/components/ui/top-nav";
import { listStartable } from "@/lib/questionnaires";

/**
 * Home.
 *
 * Two ways in, both producing something you wrote or answered yourself. The
 * type picker and check-in step from the chat model are gone: they existed to
 * configure a conversation. A journal entry needs neither — you open it and
 * write.
 *
 * ── What is deliberately absent ───────────────────────────────────────────────
 * The design's Mirror block (a sparkline over recent check-ins, plus a count of
 * facts waiting to be confirmed) is not built. Both need data that arrives with
 * Phase 6 memory extraction and a few weeks of check-ins; shipping them now
 * means a panel that is empty for weeks in the most-visited place in the
 * product. It goes in when it has something to say.
 *
 * The continuity line is built, but reduced: it states when you last wrote,
 * which is knowable today, rather than what you last wrote about, which is not.
 */

// COPY REVIEW: every user-facing string on Home — headings, descriptions and
// CTAs alike. `[COPY]` marks a placeholder; the rest is shipped wording awaiting
// the same review.
const COPY = {
  headline: "[COPY] What would you like to do?",
  lastWrote: (when: string) => `[COPY] You last wrote ${when}.`,
  recordCount: (n: number) =>
    `[COPY] ${n} ${n === 1 ? "record" : "records"} so far`,
  startError: "[COPY] Something went wrong. Please try again.",

  unfinishedLabel: (when: string) => `[COPY] Unfinished · ${when}`,
  unfinishedFallback: "[COPY] Something you started",
  unfinishedCta: "[COPY] Pick it back up",

  writeEyebrow: "[COPY] Open reflection",
  writeTitle: "[COPY] Write what's there",
  writeBody:
    "[COPY] Nothing to answer. A few footholds wait in the margin if you want a way in.",
  writeCta: "[COPY] Begin",

  frameworkEyebrow: "[COPY] Frameworks",
  frameworkBody: "[COPY] Structured questions, then back to your own words.",
  frameworkCta: "[COPY] Start",
  frameworkPickLabel: "[COPY] Choose a framework",

  checkinEyebrow: "[COPY] Check-in",
  checkinDone: "[COPY] Logged today. You can change it if something shifted.",
  checkinTodo:
    "[COPY] Sleep, mood, energy, and what you kept up. Fifteen seconds.",
  checkinChangeCta: "[COPY] Change it",
  checkinLogCta: "[COPY] Log",

  opening: "[COPY] Opening…",

  recentHeading: "[COPY] Recent",
  seeEverything: "[COPY] See everything →",
} as const;

/**
 * The instruments offered on Home, from the registry.
 *
 * Trackers are excluded: the daily check-in is a different weight of action and
 * has its own strip further down. `listStartable()` already applies the
 * `shipped` gate, so an unshipped instrument cannot appear here by omission.
 *
 * Computed at module scope — the definitions are static data and do not change
 * between renders.
 */
const INSTRUMENTS = listStartable().filter((q) => q.kind === "likert");

export type RecentRow = {
  id: string;
  href: string;
  /** ISO string — the card formats it. */
  at: string;
  /** Categories, or a check-in's values. The card's subheader. */
  detail: string[];
  kindLabel: string;
  framework: boolean;
};

export function ScreenHome({
  greeting,
  admin,

  lastWrote,
  unfinished,
  recent,
  checkedInToday,
  totalRecords,
}: {
  greeting: string;
  /** Rendered admin entry points from the server parent — see admin-nav.tsx. */
  admin: React.ReactNode;

  /** Relative phrasing for the last completed entry, or null when there is none. */
  lastWrote: string | null;
  /** An entry with writing in it that was never finished. */
  unfinished: { id: string; title: string | null; when: string } | null;
  recent: RecentRow[];
  checkedInToday: boolean;
  totalRecords: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<
    "entry" | "framework" | "checkin" | null
  >(null);
  /** Which instrument the picker has selected. */
  const [instrument, setInstrument] = useState(INSTRUMENTS[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);

  async function start(
    kind: "entry" | "framework" | "checkin",
    slug?: string
  ) {
    setLoading(kind);
    setError(null);
    try {
      const res =
        kind === "entry"
          ? await fetch("/api/reflections", { method: "POST" })
          : await fetch("/api/questionnaires", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug }),
            });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        reflectionId?: string;
        responseId?: string;
      };
      // Questionnaires open inside the archive; only the writing surface is a
      // screen of its own. Linked straight there rather than through the old
      // routes, which redirect — correct, but a wasted hop from here.
      //
      // `?edit=1`: starting a check-in from here means intending to fill it in.
      // Without it an already-completed response opens read-only, which is
      // right when arriving from the archive and wrong when pressing "Log".
      if (kind === "entry") router.push(`/reflection/${data.reflectionId}`);
      else if (kind === "checkin")
        router.push(`/reflections/checkin/${data.responseId}?edit=1`);
      else router.push(`/reflections/framework/${data.responseId}?edit=1`);
    } catch {
      setError(COPY.startError);
      setLoading(null);
    }
  }

  return (
    <PageBg>
      <TopNav active="today" admin={admin} />

      <main className="flex-1 px-5 pb-14 pt-9">
        <div className="mx-auto w-full" style={{ maxWidth: 780 }}>
          <div className="mb-[26px]">
            <Eyebrow>{greeting}</Eyebrow>
            <h1
              className="mt-[9px] max-w-[560px]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "27px",
                lineHeight: 1.34,
                fontWeight: 380,
                letterSpacing: "-0.02em",
                color: "var(--rf-text)",
              }}
            >
              {COPY.headline}
            </h1>
            {lastWrote && (
              <p
                className="mt-[10px]"
                style={{ fontSize: "13px", color: "var(--rf-text-3)" }}
              >
                {COPY.lastWrote(lastWrote)}{" "}
                <Link
                  href="/reflections"
                  className="underline underline-offset-[3px]"
                  style={{
                    color: "var(--rf-text-2)",
                    textDecorationColor: "var(--rf-border-strong)",
                  }}
                >
                  {COPY.recordCount(totalRecords)}
                </Link>
                .
              </p>
            )}
          </div>

          {/* An entry with words in it that was never finished. Surfaced above
              the launch cards because starting a second one while the first sits
              open is almost never what someone meant to do. */}
          {unfinished && (
            <Link
              href={`/reflection/${unfinished.id}`}
              className="mb-[18px] flex flex-wrap items-center justify-between gap-4 rounded-[4px] px-5 py-[15px]"
              style={{
                background: "var(--rf-accent-soft)",
                boxShadow: "inset 0 0 0 1px var(--rf-accent-soft)",
              }}
            >
              <div className="min-w-0">
                <Eyebrow accent size={9.5}>
                  {COPY.unfinishedLabel(unfinished.when)}
                </Eyebrow>
                <p
                  className="mt-1 truncate"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16.5px",
                    color: "var(--rf-text)",
                  }}
                >
                  {unfinished.title ?? COPY.unfinishedFallback}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full"
                style={{
                  padding: "8px 15px",
                  fontSize: "12.5px",
                  color: "var(--rf-paper)",
                  background: "var(--rf-accent)",
                }}
              >
                {COPY.unfinishedCta}
              </span>
            </Link>
          )}

          <div className="grid gap-[18px] sm:grid-cols-2">
            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow accent size={9.5}>
                  {COPY.writeEyebrow}
                </Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "22px",
                    lineHeight: 1.2,
                    fontWeight: 380,
                    letterSpacing: "-0.014em",
                    color: "var(--rf-text)",
                  }}
                >
                  {COPY.writeTitle}
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  {COPY.writeBody}
                </p>
                <div>
                  <button
                    onClick={() => start("entry")}
                    disabled={loading !== null}
                    className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--rf-text)",
                      color: "var(--rf-paper)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                    }}
                  >
                    {loading === "entry" ? COPY.opening : COPY.writeCta}
                  </button>
                </div>
              </div>
            </Sheet>

            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow size={9.5}>{COPY.frameworkEyebrow}</Eyebrow>
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  {COPY.frameworkBody}
                </p>

                {/* A picker, not a list. Driven by the registry rather than
                    hard-coded, so shipping an instrument is a flag in its own
                    file and nothing here needs touching — and the card stays
                    one fixed height however many there are, which a list of
                    every option would not. Trackers are excluded: the daily
                    check-in has its own strip below. */}
                <div className="flex flex-1 flex-col justify-end gap-[10px]">
                  <label htmlFor="framework-pick" className="sr-only">
                    {COPY.frameworkPickLabel}
                  </label>
                  <select
                    id="framework-pick"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    disabled={loading !== null}
                    className="w-full rounded-[4px] px-2 py-[7px] outline-none disabled:opacity-40"
                    style={{
                      fontSize: "13px",
                      color: "var(--rf-text)",
                      background: "var(--rf-paper)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    {INSTRUMENTS.map((q) => (
                      <option key={q.slug} value={q.slug}>
                        {q.title}
                      </option>
                    ))}
                  </select>

                  <div>
                    <button
                      onClick={() => start("framework", instrument)}
                      disabled={loading !== null || !instrument}
                      className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                      style={{
                        background: "var(--rf-text)",
                        color: "var(--rf-paper)",
                        fontSize: "12.5px",
                        fontWeight: 500,
                      }}
                    >
                      {loading === "framework"
                        ? COPY.opening
                        : COPY.frameworkCta}
                    </button>
                  </div>
                </div>
              </div>
            </Sheet>
          </div>

          {/* The check-in is a strip, not a third launch card — it is a
              different weight of action from writing or an instrument.
              "Logged today" is a statement of fact with no follow-up: it does
              not congratulate, and there is no streak behind it. */}
          <div
            className="mt-[18px] flex flex-wrap items-center justify-between gap-4 rounded-[4px] px-5 py-[15px]"
            style={{ background: "var(--rf-surface)" }}
          >
            <div>
              <Eyebrow size={9.5}>{COPY.checkinEyebrow}</Eyebrow>
              <p
                className="mt-1"
                style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
              >
                {checkedInToday ? COPY.checkinDone : COPY.checkinTodo}
              </p>
            </div>
            <button
              onClick={() => start("checkin", "daily_checkin")}
              disabled={loading !== null}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                color: "var(--rf-text-2)",
                fontSize: "12.5px",
                padding: "8px 15px",
              }}
            >
              {loading === "checkin"
                ? COPY.opening
                : checkedInToday
                  ? COPY.checkinChangeCta
                  : COPY.checkinLogCta}
            </button>
          </div>

          {error && (
            <p
              className="mt-4 text-center"
              style={{ fontSize: "12.5px", color: "var(--color-error)" }}
            >
              {error}
            </p>
          )}

          {recent.length > 0 && (
            <section className="mt-[34px]">
              <div className="mb-[10px] flex items-baseline justify-between gap-4">
                <Eyebrow>{COPY.recentHeading}</Eyebrow>
                <Link
                  href="/reflections"
                  className="font-mono uppercase transition-colors"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-4)",
                  }}
                >
                  {COPY.seeEverything}
                </Link>
              </div>

              {/* Cards, the same ones the archive rail and the check-in panel
                  use. No rail here — a dashboard panel is not a browsing
                  surface, and "see everything" above goes to the one that is. */}
              <RecordCardList>
                {recent.map((r) => (
                  <RecordCard
                    key={r.id}
                    href={r.href}
                    kindLabel={r.kindLabel}
                    at={new Date(r.at)}
                    detail={r.detail}
                    accent={r.framework}
                  />
                ))}
              </RecordCardList>
            </section>
          )}
        </div>
      </main>
    </PageBg>
  );
}
