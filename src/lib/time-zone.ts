import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DEFAULT_TIME_ZONE, isTimeZone } from "@/lib/time";

/**
 * The person's zone, for the server to format with. See lib/time.ts.
 *
 * `cache` dedupes within one request, so a page, the layout around it and a
 * helper three calls deep share one query. Falls back to UTC until the device
 * has reported a zone — which happens on the first page view after this
 * shipped, through components/ui/time-zone-sync.tsx.
 */
const stored = cache(async (userId: string): Promise<string | null> => {
  const [row] = await db
    .select({ tz: users.timeZone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.tz ?? null;
});

/** What the account holds, or null. For the sync component to compare against. */
export async function storedTimeZone(userId: string): Promise<string | null> {
  return stored(userId);
}

/** The zone to format in. Never null; never the host's. */
export async function timeZoneFor(userId: string): Promise<string> {
  const tz = await stored(userId);
  return tz && isTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}
