"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";

/**
 * The two controls on the Mirror admin page.
 *
 * ── Why these are not plain forms ─────────────────────────────────────────────
 * They were, and the page appeared to freeze. A form posting to a server action
 * gives no sign that a click registered, leaves the button live so it can be
 * pressed again, and blocks until the whole page re-renders. For a run that
 * takes minutes — one Claude call over somebody's entire archive, per account —
 * that is indistinguishable from the tab having hung.
 *
 * So: a disabled button, a count of how long it has been going, and the result
 * stated in words when it finishes. The work itself is unchanged; what changed
 * is that you can tell it is happening.
 */

const CHOICES = [7, 14, 30] as const;

type RunResult = { ran: number; failed: number; errors: string[]; ms: number };

export function MirrorControls({
  initialDays,
  accounts,
  disabled,
}: {
  initialDays: number;
  accounts: number;
  /** True while the instructions are unwritten — nothing can run. */
  disabled: boolean;
}) {
  const router = useRouter();

  const [days, setDays] = useState(initialDays);
  const [savingDays, setSavingDays] = useState<number | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function chooseCadence(next: number) {
    setSavingDays(next);
    setDaysError(null);
    try {
      const res = await fetch("/api/admin/mirror/cadence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDays(next);
    } catch {
      setDaysError("Couldn't save that. The setting is unchanged.");
    } finally {
      setSavingDays(null);
    }
  }

  async function run() {
    setRunning(true);
    setResult(null);
    setRunError(null);
    setElapsed(0);

    // A number that moves is the difference between "working" and "hung".
    const started = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000
    );

    try {
      const res = await fetch("/api/admin/mirror/run", { method: "POST" });
      if (!res.ok) throw new Error(`The run failed (${res.status}).`);
      const data = (await res.json()) as RunResult;
      setResult(data);
      // The table of counts above is now out of date.
      router.refresh();
    } catch (err) {
      setRunError(
        err instanceof Error
          ? err.message
          : "The run failed and said nothing useful."
      );
    } finally {
      clearInterval(tick);
      setRunning(false);
    }
  }

  return (
    <>
      <Sheet className="mb-6 px-5 py-4">
        <Eyebrow size={9.5}>How often</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          A report is produced for someone every{" "}
          <strong style={{ color: "var(--rf-text)" }}>{days} days</strong>, and
          skipped entirely when they have written nothing since the last one — no
          run, no record, nothing charged.
        </p>

        <div className="mt-3 flex flex-wrap gap-[6px]">
          {CHOICES.map((choice) => {
            const on = choice === days;
            const saving = savingDays === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => void chooseCadence(choice)}
                disabled={savingDays !== null}
                className="rounded-full transition-colors disabled:opacity-50"
                style={{
                  padding: "5px 13px",
                  fontSize: "12px",
                  color: on ? "var(--rf-paper)" : "var(--rf-text-3)",
                  background: on ? "var(--rf-text)" : "transparent",
                  boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border)",
                }}
              >
                {saving ? "Saving…" : `${choice} days`}
              </button>
            );
          })}
        </div>

        {daysError && (
          <p
            aria-live="polite"
            className="mt-2"
            style={{ fontSize: "12px", color: "var(--color-error)" }}
          >
            {daysError}
          </p>
        )}
      </Sheet>

      <Sheet className="px-5 py-4">
        <Eyebrow size={9.5}>Run for every account</Eyebrow>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          Produces a report for every account with at least one finished entry,
          immediately. It ignores the schedule above and runs even for people who
          have written nothing since their last report, so pressing it twice
          gives the same person two reports.
        </p>
        <p
          className="mt-2"
          style={{ fontSize: "12px", lineHeight: 1.55, color: "var(--rf-text-4)" }}
        >
          These reports are about other people and appear in their Mirror, not
          yours. They can delete them. Each one is a single call over that
          person&apos;s whole archive, so expect roughly half a minute per
          account.
        </p>

        <button
          type="button"
          onClick={() => void run()}
          disabled={disabled || running}
          className="mt-4 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            padding: "7px 15px",
            fontSize: "12.5px",
            fontWeight: 500,
            background: "var(--rf-text)",
            color: "var(--rf-paper)",
          }}
        >
          {running
            ? `Running… ${elapsed}s`
            : `Run for all ${accounts} ${accounts === 1 ? "account" : "accounts"}`}
        </button>

        {running && (
          <p
            aria-live="polite"
            className="mt-2"
            style={{ fontSize: "12px", color: "var(--rf-text-4)" }}
          >
            Leave this page open. Closing it does not stop the run, but you will
            not see the result.
          </p>
        )}

        {result && (
          <p
            aria-live="polite"
            className="mt-3"
            style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--rf-text)" }}
          >
            {result.ran} {result.ran === 1 ? "report" : "reports"} produced
            {result.failed > 0 ? `, ${result.failed} failed` : ""} in{" "}
            {Math.round(result.ms / 1000)}s.
          </p>
        )}

        {result?.errors.length ? (
          <ul className="mt-2">
            {result.errors.map((e, i) => (
              <li
                key={i}
                className="font-mono"
                style={{ fontSize: "11px", color: "var(--color-error)" }}
              >
                {e}
              </li>
            ))}
          </ul>
        ) : null}

        {runError && (
          <p
            aria-live="polite"
            className="mt-3"
            style={{ fontSize: "13px", color: "var(--color-error)" }}
          >
            {runError}
          </p>
        )}
      </Sheet>
    </>
  );
}
