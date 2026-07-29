import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Keep-alive and smoke test, hit daily by Vercel Cron (see vercel.json).
 *
 * Free-tier Supabase projects pause after ~7 days without activity, and
 * un-pausing is a manual click in the dashboard — the app is simply down until
 * someone notices. A daily ping keeps it well inside that window.
 *
 * It must run a real query. A bare 200 never touches Postgres, so the project
 * would pause anyway while the cron reported success every day.
 *
 * It also asserts ANTHROPIC_API_KEY is present. That variable is validated
 * lazily (see env.ts), so a deploy missing it boots fine, serves login and
 * signup fine, and fails on the user's first message. This turns that into a
 * daily check instead of a discovery.
 *
 * Returns no user data.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel sends this header automatically on cron invocations when CRON_SECRET
  // is set. Without the check the endpoint is an open database ping.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch (err) {
    console.error("Health check: database unreachable:", err instanceof Error ? err.message : err);
    checks.database = "error";
  }

  checks.anthropicKey = process.env.ANTHROPIC_API_KEY ? "present" : "missing";

  const healthy = checks.database === "ok" && checks.anthropicKey === "present";

  return Response.json(
    { status: healthy ? "ok" : "degraded", checks, at: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
