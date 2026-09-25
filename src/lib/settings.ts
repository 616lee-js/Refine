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
 * How many days between Mirror reviews.
 *
 * A setting rather than a constant so the cadence can move between weekly and
 * fortnightly without a deploy — the product owner asked for exactly that
 * choice, and which one is right is not knowable until reviews have run against
 * real writing.
 */
export const MIRROR_REVIEW_INTERVAL_DAYS = "mirror_review_interval_days";

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

/**
 * Reads a numeric flag.
 *
 * A stored value that is not a finite number falls back rather than propagating
 * — a NaN interval would make every user due on every run, which for a setting
 * that gates an AI call is an expensive way to fail.
 */
export async function getNumberSetting(
  key: string,
  fallback: number
): Promise<number> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  return typeof row?.value === "number" && Number.isFinite(row.value)
    ? row.value
    : fallback;
}

export async function setNumberSetting(
  key: string,
  value: number
): Promise<void> {
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number`);
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
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
