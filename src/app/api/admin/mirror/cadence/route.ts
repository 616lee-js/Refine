import { requireAdmin } from "@/lib/auth/admin";
import {
  MIRROR_REVIEW_ANCHOR_DAY,
  MIRROR_REVIEW_ANCHOR_TIME_ZONE,
  MIRROR_REVIEW_INTERVAL_DAYS,
  setNumberSetting,
  setStringSetting,
} from "@/lib/settings";
import { isTimeZone, parseLocalDay } from "@/lib/time";

/**
 * How often reports are produced.
 *
 * A route rather than a server action for the same reason as its neighbour:
 * the page can say "saved" the moment it is, instead of a click that appears to
 * do nothing until the whole page re-renders.
 *
 * Gated independently of the page that calls it.
 */

export const dynamic = "force-dynamic";

/** The cadences worth offering. Anything else is refused rather than clamped. */
const CHOICES = [7, 14, 30];

export async function POST(req: Request) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { days, anchorDay, timeZone } = body as {
    days?: unknown;
    anchorDay?: unknown;
    timeZone?: unknown;
  };

  // Either the interval, or the schedule's start (day + zone). Not neither.
  if (days !== undefined) {
    if (typeof days !== "number" || !CHOICES.includes(days)) {
      return new Response("days must be 7, 14 or 30", { status: 400 });
    }
    await setNumberSetting(MIRROR_REVIEW_INTERVAL_DAYS, days);
    return Response.json({ days });
  }

  const day = parseLocalDay(anchorDay);
  if (!day || !isTimeZone(timeZone)) {
    return new Response("anchorDay (YYYY-MM-DD) and a valid timeZone required", {
      status: 400,
    });
  }
  await setStringSetting(MIRROR_REVIEW_ANCHOR_DAY, day);
  await setStringSetting(MIRROR_REVIEW_ANCHOR_TIME_ZONE, timeZone);
  return Response.json({ anchorDay: day, timeZone });
}
