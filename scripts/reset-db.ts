/**
 * Drops all app tables and types, then exits.
 * Run drizzle-kit migrate afterward to recreate the schema.
 *
 * Usage:
 *   npm run db:reset
 *   npm run db:migrate
 *
 * WARNING: destroys all data.
 *
 * ── Refuses to run against anything but localhost ─────────────────────────────
 * Since the deployment, .env.local points DATABASE_URL at Supabase. A single
 * wrong --env-file would otherwise drop every table in production, silently and
 * irreversibly. There is deliberately no override flag: if you genuinely need to
 * reset a remote database, do it from the Supabase dashboard, not from a script
 * whose whole purpose is to be quick.
 */
import { Pool } from "pg";

function assertLocal(connectionString: string | undefined): void {
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    console.error("DATABASE_URL is not a parseable URL.");
    process.exit(1);
  }

  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!local) {
    console.error(
      `\n  REFUSING TO RUN.\n\n` +
        `  DATABASE_URL points at a remote host (${hostname.slice(0, 6)}***), not localhost.\n` +
        `  This script drops every table. It only runs against a local database.\n\n` +
        `  If you meant to reset local Docker Postgres, check which env file was loaded —\n` +
        `  .env.local now points at Supabase.\n`
    );
    process.exit(1);
  }
}

async function reset() {
  assertLocal(process.env.DATABASE_URL);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Child-first; CASCADE handles the rest. Kept in step with schema.ts — the
    // pre-rename names (sessions, session_summaries) are gone, and invite_codes,
    // user_profiles and content_access_log are included.
    const drops = [
      "DROP TABLE IF EXISTS content_access_log CASCADE",
      "DROP TABLE IF EXISTS safety_log CASCADE",
      "DROP TABLE IF EXISTS reflection_summaries CASCADE",
      "DROP TABLE IF EXISTS user_memory CASCADE",
      "DROP TABLE IF EXISTS user_profiles CASCADE",
      "DROP TABLE IF EXISTS entries CASCADE",
      "DROP TABLE IF EXISTS check_ins CASCADE",
      "DROP TABLE IF EXISTS reflections CASCADE",
      "DROP TABLE IF EXISTS invite_codes CASCADE",
      "DROP TABLE IF EXISTS users CASCADE",
      "DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE",
      "DROP SCHEMA IF EXISTS drizzle CASCADE",
      "DROP TYPE IF EXISTS entry_source CASCADE",
      "DROP TYPE IF EXISTS memory_kind CASCADE",
      "DROP TYPE IF EXISTS memory_source CASCADE",
      "DROP TYPE IF EXISTS reflection_modality CASCADE",
      "DROP TYPE IF EXISTS reflection_type CASCADE",
    ];

    for (const sql of drops) {
      await client.query(sql);
    }

    await client.query("COMMIT");
    console.log("All tables dropped. Run `npm run db:migrate` to recreate.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(0);
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
