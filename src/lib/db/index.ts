import "@/lib/env"; // validates env vars before any DB connection attempt
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

/**
 * Postgres connection pool, tuned for serverless.
 *
 * DATABASE_URL is the Supabase POOLED string (Supavisor transaction mode, port
 * 6543). Supavisor does the real connection multiplexing; the settings below
 * bound what a single function instance can hold.
 *
 * Why each value:
 *
 * max: 3 — every warm Vercel instance keeps its own pool, so the real ceiling is
 *   max × concurrent instances. The previous default of 10 multiplied fast
 *   enough to exhaust a small Supabase compute under trivial load.
 *
 * connectionTimeoutMillis: 10s — the pg default is 0, meaning "wait forever".
 *   That turns pool exhaustion into requests that hang until the platform kills
 *   them, with no error to read. Failing is more useful than hanging.
 *
 * idleTimeoutMillis: 10s — release connections back to Supavisor quickly; a
 *   serverless instance is usually idle between bursts.
 *
 * ssl — Supabase serves its database endpoints from its OWN private CA, not a
 *   publicly-trusted one. (An earlier version of this comment claimed otherwise;
 *   it was wrong.) Verified against the live pooler: every configuration that
 *   checks the system trust store fails with SELF_SIGNED_CERT_IN_CHAIN. So the
 *   Supabase root is pinned explicitly, which is stronger than the system store
 *   would be — exactly one issuer is accepted.
 *
 *   Local Docker Postgres speaks no TLS at all, so this applies only to remote
 *   hosts. Do NOT downgrade the remote case to rejectUnauthorized: false: that
 *   keeps the traffic encrypted but stops verifying who is on the other end, on
 *   a link carrying PHI-grade journal content. Note that removing the ssl option
 *   entirely is worse still — it connects in plaintext.
 *
 * Transaction-mode caveat: prepared statements and session-level state are not
 * supported on port 6543. Nothing here uses them — drizzle's node-postgres
 * driver only prepares when .prepare() is called explicitly, and no call site
 * does. Adding one would break in production only. Explicit db.transaction() IS
 * supported; the connection pins for the transaction's duration, which is what
 * makes the invite-code claim safe.
 */
/** Local Docker Postgres has no TLS; every hosted provider requires it. */
function isLocalHost(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  return new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocalHost(connectionString)
      ? undefined
      : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  });
}

/**
 * Reuse one pool across hot reloads and warm invocations.
 *
 * Without this guard, every HMR cycle in `next dev` built a fresh pool and never
 * called pool.end() — a steady connection leak across a long dev session, and
 * the same shape of leak across module re-evaluation in serverless.
 */
const globalForDb = globalThis as unknown as { __refinePool?: Pool };

const pool = globalForDb.__refinePool ?? createPool();
globalForDb.__refinePool = pool;

export const db = drizzle(pool, { schema });
