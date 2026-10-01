"use client";

import { useState } from "react";
import Link from "next/link";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { instrumentLabel, listStartable } from "@/lib/questionnaires";
import { useStartRecord } from "./use-start-record";
import { HomeCheckin } from "./home-checkin";
import { HomeCalendar, type CalendarMonth } from "./home-calendar";
import type { Answers, TrackerQuestionnaire } from "@/lib/questionnaires";

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
  /*
   * How often, said rather than enforced.
   *
   * Open writing is the most useful thing here and is invited at any time, in any
   * shape — which is a thing worth saying, because a screen offering three options
   * with no guidance implies they are interchangeable.
   *
   * Nothing computes whether anything is due, and nothing nags. A rhythm the
   * person sets, with a marker when something is outstanding, was deferred by the
   * product owner on 2026-10-01 pending more thought — so this is wording only.
   * Do not let it grow into a schedule without that decision.
   */
  writeCadence: "[COPY] Whenever you like — most useful kept often.",
  writeCta: "[COPY] Begin",

  frameworkEyebrow: "[COPY] Frameworks",
  frameworkBody: "[COPY] Structured questions, then back to your own words.",
  /**
   * The suggested rhythm comes from the instrument itself (`cadence`), so the
   * card cannot disagree with the record screen, which already prints the same
   * string. Suggested, not enforced: nothing checks it.
   */
  frameworkCadence: (cadence: string) => `[COPY] Suggested: ${cadence}. Use one whenever you want.`,
  frameworkCta: "[COPY] Start",
  frameworkPickLabel: "[COPY] Choose a framework",

  opening: "[COPY] Opening…",
} as const;

/**
 * The instruments offered on Home, from the registry.
 *
 * Trackers are excluded: the daily check-in is answered in place further down
 * rather than started. `listStartable()` already applies the `shipped` gate, so an
 * unshipped instrument cannot appear here by omission.
 *
 * Computed at module scope — the definitions are static data and do not change
 * between renders.
 */
const INSTRUMENTS = listStartable().filter((q) => q.kind === "likert");

export function ScreenHome({
  greeting,
  admin,

  lastWrote,
  unfinished,
  checkin,
  month,
  totalRecords,
}: {
  greeting: string;
  /** Rendered admin entry points from the server parent — see admin-nav.tsx. */
  admin: React.ReactNode;

  /** Relative phrasing for the last completed entry, or null when there is none. */
  lastWrote: string | null;
  /** An entry with writing in it that was never finished. */
  unfinished: { id: string; title: string | null; when: string } | null;
  /** The daily check-in, answered here. See ./home-checkin.tsx. */
  checkin: {
    questionnaire: TrackerQuestionnaire;
    initialAnswers: Answers;
    alreadyToday: boolean;
  };
  /** One month of the record, built on the server. See lib/journal/month.ts. */
  month: CalendarMonth;
  totalRecords: number;
}) {
  /** Which instrument the picker has selected. */
  const [instrument, setInstrument] = useState(INSTRUMENTS[0]?.slug ?? "");

  // The three create calls and where each one lands now live in one place,
  // because the archive's record panel offers the same three. See
  // ./use-start-record.ts.
  const { start, starting: loading, failed } = useStartRecord();

  /*
   * The suggested rhythm of whichever instrument is picked.
   *
   * Read from the instrument rather than written on the card, so the two cannot
   * disagree and a new instrument brings its own. Undefined where an instrument
   * carries none, in which case the line is simply absent rather than guessed at.
   */
  const selectedCadence = INSTRUMENTS.find((q) => q.slug === instrument)?.cadence;

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
                <p
                  style={{
                    fontSize: "11.5px",
                    color: "var(--rf-text-4)",
                  }}
                >
                  {COPY.writeCadence}
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
                {selectedCadence && (
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "var(--rf-text-4)",
                    }}
                  >
                    {COPY.frameworkCadence(selectedCadence)}
                  </p>
                )}

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
                        {instrumentLabel(q)}
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

          {failed && (
            <p
              className="mt-4 text-center"
              style={{ fontSize: "12.5px", color: "var(--color-error)" }}
            >
              {COPY.startError}
            </p>
          )}

          {/* The four fields themselves, not a button to a screen with them on.
              Pressing the old strip created a record and navigated away, which is
              four taps of work behind a page change. See ./home-checkin.tsx. */}
          <HomeCheckin
            questionnaire={checkin.questionnaire}
            initialAnswers={checkin.initialAnswers}
            alreadyToday={checkin.alreadyToday}
          />

          <HomeCalendar month={month} />
        </div>
      </main>
    </PageBg>
  );
}
