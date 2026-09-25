import { Client } from "pg";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";

/**
 * Backup and restore.
 *
 * ── Data only. Schema comes from the migrations ───────────────────────────────
 * Drizzle owns the schema, so a dump does not need to carry it — and should not.
 * A restore is: create an empty database, run `npm run db:migrate`, load the
 * data. That is more reliable than a pg_dump for this project, because the
 * schema that gets recreated is the one in version control rather than whatever
 * shape the server happened to be in when the dump ran.
 *
 * It also sidesteps pg_dump's version-matching entirely. pg_dump refuses to dump
 * a server newer than itself, which on Windows means chasing a client install
 * that matches whatever Postgres version Supabase upgraded to this quarter.
 * This uses the same `pg` driver the application already depends on.
 *
 * ── A DUMP WITHOUT THE ENCRYPTION KEY IS WORTHLESS ────────────────────────────
 * Every journal entry in this file is AES-256-GCM ciphertext. Without
 * ENCRYPTION_KEY it is unrecoverable noise, and without EMAIL_HMAC_KEY no
 * account can be found to log in to. Those two values are not in this file, on
 * purpose — a backup containing both the ciphertext and its key is not a backup,
 * it is a plaintext copy.
 *
 * Store the keys separately, in a password manager. Losing either loses
 * everything, and no amount of database backup changes that.
 *
 * Usage:
 *   npm run backup                 write ./backups/refine-<timestamp>.json
 *   npm run backup -- verify FILE  check a file is complete and readable
 *   npm run backup -- restore FILE load into the DB in DATABASE_URL_DIRECT
 */

/**
 * Insert order. Parents before children — every table's foreign keys must
 * already be satisfiable when its rows land.
 */
const TABLES = [
  "users",
  "invite_codes",
  "user_profiles",
  "journal_entries",
  "journal_entry_summaries",
  "questionnaire_responses",
  // Before user_memory: a memory row points back at the review that caught it.
  "mirror_reviews",
  "user_memory",
  "safety_log",
  "content_access_log",
  // Points at users and journal_entries, so it follows both.
  "summary_evaluations",
  // Points at users and mirror_reviews, so it follows both.
  "report_evaluations",
  // No foreign keys, so position is free.
  "feedback",
  "app_settings",
] as const;

type Dump = {
  takenAt: string;
  database: string;
  tables: Record<string, Record<string, unknown>[]>;
};

function connect(): Client {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) {
    throw new Error(
      "DATABASE_URL_DIRECT is not set. Backups use the direct/session connection, not the pooled one."
    );
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new Client({
    connectionString: url,
    ssl: local
      ? undefined
      : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  });
}

/**
 * Guards against a dump that silently misses a table added in a later migration.
 *
 * Only one direction is dangerous. A live table absent from TABLES means rows
 * exist that this file will not contain, while the file still looks complete —
 * that is refused. The reverse, a name in TABLES with no table behind it yet,
 * loses nothing: it happens for the length of one backup taken between writing a
 * migration and applying it, which is exactly when a backup is most wanted.
 * Those are reported and skipped.
 *
 * Returns the tables to actually read.
 */
async function liveTables(c: Client): Promise<string[]> {
  const { rows } = await c.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const live = rows.map((r) => r.table_name).sort();
  const known: string[] = [...TABLES];
  const missing = live.filter((t) => !known.includes(t));

  if (missing.length > 0) {
    throw new Error(
      `Refusing to back up: the database has tables this script does not know about — ${missing.join(", ")}.\n` +
        `Add them to TABLES in scripts/backup.ts, in an order that satisfies foreign keys.\n` +
        `A backup that silently omits a table is worse than no backup, because it looks like one.`
    );
  }

  const notYetCreated = known.filter((t) => !live.includes(t));
  for (const t of notYetCreated) {
    console.log(`  ${t.padEnd(26)} not created yet — skipped`);
  }

  return known.filter((t) => live.includes(t));
}

async function dump() {
  const c = connect();
  await c.connect();
  try {
    const present = await liveTables(c);

    const tables: Dump["tables"] = {};
    for (const t of present) {
      const { rows } = await c.query(`SELECT * FROM "${t}"`);
      tables[t] = rows;
      console.log(`  ${t.padEnd(26)} ${rows.length} rows`);
    }

    const { rows: dbRows } = await c.query<{ current_database: string }>(
      "SELECT current_database()"
    );

    const payload: Dump = {
      takenAt: new Date().toISOString(),
      database: dbRows[0].current_database,
      tables,
    };

    const dir = join(process.cwd(), "backups");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const stamp = payload.takenAt.replace(/[:.]/g, "-");
    const file = join(dir, `refine-${stamp}.json`);
    writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");

    const total = Object.values(tables).reduce((n, r) => n + r.length, 0);
    console.log(`\nWrote ${file}`);
    console.log(`${total} rows across ${present.length} tables.`);
    console.log(
      "\nThis file is ciphertext. Back up ENCRYPTION_KEY and EMAIL_HMAC_KEY separately,\n" +
        "or it cannot be read back."
    );
  } finally {
    await c.end();
  }
}

/**
 * Reads a backup file and says which tables it does not contain.
 *
 * Absence used to be fatal. It cannot be, now that a dump legitimately skips a
 * table that does not exist yet — and more to the point, every backup taken
 * before a table was added is absent it, which is most of them. The file cannot
 * tell you whether a table is missing because it never existed or because
 * something truncated the file.
 *
 * So it is reported, loudly, every time the file is read, and restore lands
 * those tables empty. Loud and honest beats a refusal that would block a
 * legitimate restore from an older file.
 */
function load(file: string): { dump: Dump; absent: string[] } {
  const parsed = JSON.parse(readFileSync(file, "utf-8")) as Dump;
  if (!parsed.tables) throw new Error("Not a Refine backup: no `tables` key.");
  const absent = TABLES.filter((t) => !(t in parsed.tables));
  if (absent.length > 0) {
    console.log(
      `\nNot in this file: ${absent.join(", ")}.\n` +
        `Either taken before those tables existed, or the file is incomplete.\n` +
        `A restore would leave them empty.\n`
    );
  }
  return { dump: parsed, absent };
}

/** Reads a backup without touching the database. Safe to run any time. */
function verify(file: string) {
  const { dump: d, absent } = load(file);
  console.log(`Backup taken   : ${d.takenAt}`);
  console.log(`Source database: ${d.database}\n`);
  let total = 0;
  for (const t of TABLES) {
    const rows = d.tables[t];
    if (!rows) {
      console.log(`  ${t.padEnd(26)} absent`);
      continue;
    }
    total += rows.length;
    console.log(`  ${t.padEnd(26)} ${rows.length} rows`);
  }
  console.log(
    `\n${total} rows across ${TABLES.length - absent.length} of ${TABLES.length} tables.`
  );

  const entries = d.tables["journal_entries"] ?? [];
  const withBody = entries.filter((e) => e["encrypted_body"]).length;
  console.log(
    `journal_entries with content: ${withBody}/${entries.length} (the rest are drafts or purged shells)`
  );
}

/**
 * Loads a backup into the database named by DATABASE_URL_DIRECT.
 *
 * Runs in ONE transaction: either every table lands or none does. A restore that
 * half-succeeds is the worst outcome available — a database that looks populated
 * and is missing rows nobody will notice for months.
 *
 * Requires the target to be empty. It does not delete, and it does not merge:
 * overwriting a live database is not something a script should be able to do by
 * accident, and merging two divergent copies is a decision, not a default.
 */
async function restore(file: string) {
  const { dump: d } = load(file);
  const c = connect();
  await c.connect();

  try {
    // Restore targets a migrated database, so every table must exist here —
    // unlike a dump, where one can legitimately be a migration behind.
    const present = await liveTables(c);

    for (const t of present) {
      const { rows } = await c.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM "${t}"`
      );
      if (Number(rows[0].count) > 0) {
        throw new Error(
          `Refusing to restore: "${t}" already has ${rows[0].count} rows.\n` +
            `Restore targets an EMPTY database. Point DATABASE_URL_DIRECT at a fresh one\n` +
            `that has had \`npm run db:migrate\` run against it.`
        );
      }
    }

    await c.query("BEGIN");
    let total = 0;

    for (const t of TABLES) {
      // A file written before this table existed simply has no key for it.
      // Restoring an older backup into a newer schema is a legitimate thing to
      // want, and the table lands empty, which is what it was.
      const rows = d.tables[t] ?? [];
      if (rows.length === 0) {
        console.log(`  ${t.padEnd(26)} 0 rows`);
        continue;
      }

      const cols = Object.keys(rows[0]);
      const quoted = cols.map((col) => `"${col}"`).join(", ");

      for (const row of rows) {
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map((col) => {
          const v = row[col];
          // jsonb round-trips through the driver as an object; everything else
          // is a string, number, boolean, or null already.
          return v !== null && typeof v === "object" && !(v instanceof Date)
            ? JSON.stringify(v)
            : v;
        });
        await c.query(
          `INSERT INTO "${t}" (${quoted}) VALUES (${placeholders})`,
          values
        );
      }

      total += rows.length;
      console.log(`  ${t.padEnd(26)} ${rows.length} rows`);
    }

    await c.query("COMMIT");
    console.log(`\nRestored ${total} rows from ${file}.`);
    console.log(
      "Log in to confirm. If entries do not decrypt, ENCRYPTION_KEY does not match\n" +
        "the one in use when the backup was taken — restore that key, not the data."
    );
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

const [command, file] = process.argv.slice(2);

(async () => {
  if (!command || command === "dump") return dump();
  if (command === "verify") {
    if (!file) throw new Error("Usage: npm run backup -- verify <file>");
    return verify(file);
  }
  if (command === "restore") {
    if (!file) throw new Error("Usage: npm run backup -- restore <file>");
    return restore(file);
  }
  throw new Error(`Unknown command "${command}". Use dump, verify, or restore.`);
})().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
