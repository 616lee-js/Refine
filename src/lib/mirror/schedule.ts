import {
  addDays,
  dayStart,
  daysBetween,
  localDay,
  type LocalDay,
} from "@/lib/time";

/**
 * When Mirror reports run: a fixed schedule, not "N days since the last one".
 *
 * ── The product owner's instruction, 2026-11-11 ───────────────────────────────
 * "Set the next one to run Sunday 11/15 12AM Pacific time, and if the cadence is
 * set for every 14 days, run that relative to Sunday 12AM."
 *
 * So the schedule is an anchor — a calendar day at midnight in a named zone —
 * and an interval in days. Run times are anchor, anchor + 14 days, anchor + 28
 * days, … each at local midnight in that zone, which keeps them at midnight
 * across a clock change rather than drifting by an hour.
 *
 * A person is due at a run time when their last report is older than it. A run
 * time that was missed (the job died, the platform skipped) is still "the most
 * recent run time" the next day, so it is caught up rather than lost. Running
 * a report by hand does not move the schedule: the next scheduled run still
 * happens on its day, provided the person has written since.
 *
 * Pure: no database. The three values come from app_settings — see review.ts.
 */

export type Schedule = {
  /** `YYYY-MM-DD` of the first run, in `timeZone`. */
  anchorDay: LocalDay;
  /** The zone whose midnight the schedule keeps, e.g. "America/Los_Angeles". */
  timeZone: string;
  intervalDays: number;
};

/**
 * The most recent scheduled run time at or before `now`, or null when the
 * schedule has not started yet.
 */
export function latestRunAt(s: Schedule, now: Date): Date | null {
  const today = localDay(now, s.timeZone);
  const elapsed = daysBetween(s.anchorDay, today);
  if (elapsed < 0) return null;

  let k = Math.floor(elapsed / s.intervalDays);
  let day = addDays(s.anchorDay, k * s.intervalDays);
  let at = dayStart(day, s.timeZone);
  // Same calendar day as a run, but before its midnight has arrived.
  if (at > now) {
    k -= 1;
    if (k < 0) return null;
    day = addDays(s.anchorDay, k * s.intervalDays);
    at = dayStart(day, s.timeZone);
  }
  return at;
}

/** The next scheduled run time strictly after `now`. */
export function nextRunAt(s: Schedule, now: Date): Date {
  const latest = latestRunAt(s, now);
  if (!latest) return dayStart(s.anchorDay, s.timeZone);
  const latestDay = localDay(latest, s.timeZone);
  return dayStart(addDays(latestDay, s.intervalDays), s.timeZone);
}
