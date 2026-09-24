import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

/**
 * Operational flags an admin can change without a redeploy.
 *
 * **Never user data.** Anything about a person belongs in that person's own
 * tables; this is for switches that govern how the system behaves. An
 * environment variable would have done, except that changing one needs a
 * deploy and these need to be switchable from the admin UI.
 */

/**
 * Whether new assessments capture a copy of the entry and the summary they
 * judged.
 *
 * Off does not touch snapshots already taken — it only stops new ones. Clearing
 * existing snapshots is a separate, deliberate admin action.
 */
export const EVAL_SNAPSHOTS_ENABLED = "eval_snapshots_enabled";

/**
 * Reads a boolean flag.
 *
 * Defaults are passed in rather than assumed, so a missing row means "nobody
 * has set this yet" rather than silently meaning false — the difference matters
 * for a flag that governs whether journal content gets stored.
 */
export async function getBooleanSetting(
  key: string,
  fallback: boolean
): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  return typeof row?.value === "boolean" ? row.value : fallback;
}

export async function setBooleanSetting(
  key: string,
  value: boolean
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
