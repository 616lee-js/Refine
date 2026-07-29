import { defineConfig } from "drizzle-kit";
import { SUPABASE_ROOT_CA_2021 } from "./src/lib/db/supabase-ca";

/**
 * Migrations run against the DIRECT connection, never the pooled one.
 *
 * DDL wants a real session. Supavisor's transaction mode (port 6543) hands out a
 * different backend per statement and does not support session-level state, so
 * migrations belong on the direct port 5432 connection.
 *
 * The app reads DATABASE_URL (pooled). Migrations read DATABASE_URL_DIRECT.
 * Two strings, two consumers, no ambiguity about which is in play.
 *
 * Run:
 *   npm run db:migrate
 * with DATABASE_URL_DIRECT set in .env.local, or inline for a one-off:
 *   DATABASE_URL_DIRECT="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres?sslmode=require" npx drizzle-kit migrate
 *
 * If db.<ref>.supabase.co resolves IPv6-only from your network, substitute the
 * session-mode pooler string (port 5432 on pooler.supabase.com) — same DDL result.
 */
const url = process.env.DATABASE_URL_DIRECT;

if (!url) {
  // The previous config used a non-null assertion, so a missing value reached
  // the driver as `undefined` and surfaced as an unrelated-looking error.
  throw new Error(
    "DATABASE_URL_DIRECT is not set.\n" +
      "Migrations require the Supabase DIRECT connection string (port 5432), " +
      "not the pooled one (port 6543).\n" +
      "Set it in .env.local, or pass it inline for a single command."
  );
}

/** Local Docker speaks no TLS; Supabase requires it and uses its own CA. */
function isLocal(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
    // Same pinned root as the app — see src/lib/db/supabase-ca.ts.
    ssl: isLocal(url) ? false : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  },
});
