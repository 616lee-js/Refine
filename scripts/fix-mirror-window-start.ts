import { Client } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";

/**
 * One-off: correct Mirror report windows stored as the epoch.
 *
 * ── What was wrong ────────────────────────────────────────────────────────────
 * `reviewUser()` stored `windowStart: since ?? new Date(0)`. On a person's first
 * report there is no previous report to count from, so `since` was null and the
 * window start was saved as 1 Jan 1970 UTC — which renders as "31 Dec 1969" to
 * any viewer west of UTC. It shows in the line above the current report and in
 * every history row for that run, permanently.
 *
 * Fixed forward in src/lib/mirror/review.ts. This corrects the rows already
 * stored, because nothing else will: a report is written once and never
 * revisited.
 *
 * ── What it sets them to ──────────────────────────────────────────────────────
 * That account's earliest completed, undeleted, unpurged entry — the same value
 * the fixed code now uses. A first report genuinely did cover everything, so its
 * window genuinely does begin at the first entry.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 *   - Prints every change and writes nothing without --apply.
 *   - Touches only rows whose window_start is at or before 1970-01-02, so a real
 *     date can never be rewritten by a second run.
 *   - Never reads, decrypts or writes report content. Only this one timestamp.
 *   - One transaction, so a failure part-way leaves nothing half-corrected.
 *
 * Back up first: npm run backup
 *
 *   npm run fix:mirror-windows            # show what would change
 *   npm run fix:mirror-windows -- --apply # change it
 */

/**
 * Anything at or before this is the epoch placeholder rather than a real date.
 *
 * A day of slack rather than an exact equality test: the bug stored exactly
 * `new Date(0)`, but a timezone-shifted copy of it would land hours either side,
 * and no real entry predates this project by decades.
 */
const EPOCH_CUTOFF = new Date("1970-01-02T00:00:00Z");

type Row = {
  id: string;
  user_id: string;
  window_start: Date;
  window_end: Date;
  entries_read: number;
  earliest: Date | null;
};

function connect(): Client {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT is not set.");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new Client({
    connectionString: url,
    ssl: local
      ? undefined
      : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  });
}

const day = (at: Date) => at.toISOString().slice(0, 10);

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  const c = connect();
  await c.connect();

  try {
    /*
     * The earliest entry is joined per report rather than looked up per row, so
     * this is one query regardless of how many reports need correcting.
     */
    const { rows } = await c.query<Row>(
      `SELECT r.id, r.user_id, r.window_start, r.window_end, r.entries_read,
              (SELECT min(j.completed_at) FROM journal_entries j
                WHERE j.user_id = r.user_id
                  AND j.completed_at IS NOT NULL
                  AND j.deleted_at IS NULL
                  AND j.purged_at IS NULL) AS earliest
         FROM mirror_reviews r
        WHERE r.window_start <= $1
        ORDER BY r.created_at ASC`,
      [EPOCH_CUTOFF]
    );

    if (rows.length === 0) {
      console.log("No report has an epoch window start. Nothing to do.");
      return;
    }

    console.log(`${rows.length} report(s) with an epoch window start:\n`);

    const fixable: { id: string; to: Date }[] = [];
    const skipped: Row[] = [];

    for (const r of rows) {
      /*
       * No entries left means every one was deleted or purged after the report
       * was written. There is no honest date to substitute, and inventing one
       * would be the same class of error as the epoch. Left alone and reported.
       */
      if (!r.earliest) {
        skipped.push(r);
        continue;
      }
      fixable.push({ id: r.id, to: r.earliest });
      console.log(
        `  ${r.id.slice(0, 8)}  account ${r.user_id.slice(0, 8)}  ` +
          `${day(r.window_start)} -> ${day(r.earliest)}  ` +
          `(window ends ${day(r.window_end)}, ${r.entries_read} entries)`
      );
    }

    for (const r of skipped) {
      console.log(
        `  ${r.id.slice(0, 8)}  account ${r.user_id.slice(0, 8)}  ` +
          `SKIPPED — that account has no readable entries left, so there is ` +
          `no first-entry date to use`
      );
    }

    if (!apply) {
      console.log(
        `\nNothing written. Re-run with --apply to change ${fixable.length} row(s).`
      );
      return;
    }

    if (fixable.length === 0) {
      console.log("\nNothing correctable. No changes made.");
      return;
    }

    await c.query("BEGIN");
    try {
      for (const f of fixable) {
        // The epoch condition is repeated in the UPDATE, not just the SELECT, so
        // a row that somehow changed between the two is not overwritten.
        await c.query(
          `UPDATE mirror_reviews SET window_start = $1
            WHERE id = $2 AND window_start <= $3`,
          [f.to, f.id, EPOCH_CUTOFF]
        );
      }
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }

    console.log(`\nCorrected ${fixable.length} report window(s).`);
    if (skipped.length > 0) {
      console.log(`${skipped.length} left alone, listed above.`);
    }
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
