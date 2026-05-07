/**
 * Drops all app tables and types, then exits.
 * Run drizzle-kit migrate afterward to recreate the schema.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/reset-db.ts
 *   npm run db:migrate
 *
 * WARNING: destroys all data. Intended for Phase 3 clean start only.
 */
import { Pool } from "pg";

async function reset() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Drop tables in child-first order; CASCADE handles remaining FKs
    const drops = [
      "DROP TABLE IF EXISTS safety_log CASCADE",
      "DROP TABLE IF EXISTS session_summaries CASCADE",
      "DROP TABLE IF EXISTS user_memory CASCADE",
      "DROP TABLE IF EXISTS entries CASCADE",
      "DROP TABLE IF EXISTS check_ins CASCADE",
      "DROP TABLE IF EXISTS sessions CASCADE",
      "DROP TABLE IF EXISTS users CASCADE",
      "DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE",
      "DROP SCHEMA IF EXISTS drizzle CASCADE",
      "DROP TYPE IF EXISTS entry_source CASCADE",
      "DROP TYPE IF EXISTS memory_kind CASCADE",
      "DROP TYPE IF EXISTS memory_source CASCADE",
      "DROP TYPE IF EXISTS session_modality CASCADE",
      "DROP TYPE IF EXISTS session_type CASCADE",
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
