"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";

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

export type RecentRow = {
  id: string;
  href: string;
  at: string;
  title: string | null;
  fallback: string;
  kindLabel: string;
  framework: boolean;
};

export function ScreenHome({
  greeting,
  lastWrote,
  unfinished,
  recent,
  checkedInToday,
  totalRecords,
}: {
  greeting: string;
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
      if (kind === "entry") router.push(`/reflection/${data.reflectionId}`);
      else if (kind === "checkin") router.push(`/checkin/${data.responseId}`);
      else router.push(`/framework/${data.responseId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <PageBg>
      <TopNav active="today" />

      <main className="flex-1 px-6 pb-14 pt-9 sm:px-10">
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
              What would you like to do?
            </h1>
            {lastWrote && (
              <p
                className="mt-[10px]"
                style={{ fontSize: "13px", color: "var(--rf-text-3)" }}
              >
                You last wrote {lastWrote}.{" "}
                <Link
                  href="/reflections"
                  className="underline underline-offset-[3px]"
                  style={{
                    color: "var(--rf-text-2)",
                    textDecorationColor: "var(--rf-border-strong)",
                  }}
                >
                  {totalRecords} {totalRecords === 1 ? "record" : "records"} so
                  far
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
                  Unfinished · {unfinished.when}
                </Eyebrow>
                <p
                  className="mt-1 truncate"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "16.5px",
                    color: "var(--rf-text)",
                  }}
                >
                  {unfinished.title ?? "Something you started"}
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
                Pick it back up
              </span>
            </Link>
          )}

          <div className="grid gap-[18px] sm:grid-cols-2">
            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow accent size={9.5}>
                  Open reflection
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
                  Write what&apos;s there
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  Nothing to answer. A few footholds wait in the margin if you
                  want a way in.
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
                    {loading === "entry" ? "Opening…" : "Begin"}
                  </button>
                </div>
              </div>
            </Sheet>

            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow size={9.5}>Framework · GAD-7</Eyebrow>
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
                  Generalised anxiety
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  Seven questions, then back to your own words.
                </p>
                <div>
                  <button
                    onClick={() => start("framework", "gad7")}
                    disabled={loading !== null}
                    className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--rf-text)",
                      color: "var(--rf-paper)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                    }}
                  >
                    {loading === "framework" ? "Opening…" : "Start"}
                  </button>
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
              <Eyebrow size={9.5}>Check-in</Eyebrow>
              <p
                className="mt-1"
                style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
              >
                {checkedInToday
                  ? "Logged today. You can change it if something shifted."
                  : "Sleep, mood, energy, and what you kept up. Fifteen seconds."}
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
                ? "Opening…"
                : checkedInToday
                  ? "Change it"
                  : "Log"}
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
                <Eyebrow>Recent</Eyebrow>
                <Link
                  href="/reflections"
                  className="font-mono uppercase transition-colors"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-text-4)",
                  }}
                >
                  See everything →
                </Link>
              </div>

              <Sheet className="px-6 pb-4 pt-1">
                {recent.map((r, i) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    className="grid items-center gap-x-5 gap-y-1 py-[13px] sm:grid-cols-[1fr_auto]"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--rf-rule)",
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "16.5px",
                          color: "var(--rf-text)",
                        }}
                      >
                        {r.title ?? r.fallback}
                      </p>
                      <p
                        className="mt-[3px] font-mono uppercase"
                        style={{
                          fontSize: "9.5px",
                          letterSpacing: "0.14em",
                          color: "var(--rf-text-4)",
                        }}
                      >
                        {r.at}
                      </p>
                    </div>
                    <span
                      className="w-fit rounded-full font-mono uppercase"
                      style={{
                        padding: "4px 9px",
                        fontSize: "9.5px",
                        letterSpacing: "0.12em",
                        color: r.framework
                          ? "var(--rf-accent)"
                          : "var(--rf-text-3)",
                        background: r.framework
                          ? "var(--rf-accent-soft)"
                          : "transparent",
                        boxShadow: r.framework
                          ? "none"
                          : "inset 0 0 0 1px var(--rf-border)",
                      }}
                    >
                      {r.kindLabel}
                    </span>
                  </Link>
                ))}
              </Sheet>
            </section>
          )}
        </div>
      </main>
    </PageBg>
  );
}
