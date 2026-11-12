"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tells the server which time zone this device is in.
 *
 * Renders nothing. On every signed-in page it reads the device's zone and, when
 * that differs from what the account holds, saves it — then refreshes the page
 * so what is on screen is already in the right zone rather than waiting for the
 * next visit. Travel is handled the same way: the first page view somewhere new
 * updates the account.
 *
 * This is the ONLY place the browser's idea of time reaches the server. Every
 * date the person sees is formatted on the server in the zone saved here; see
 * lib/time.ts for why nothing formats a date in the browser.
 *
 * `current` is what the account holds now (null before the first sync). Passing
 * it in is what stops a loop: after the refresh the two match and nothing fires.
 */
export function TimeZoneSync({ current }: { current: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || tz === current) return;

    let cancelled = false;
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: tz }),
    })
      .then((res) => {
        if (!cancelled && res.ok) router.refresh();
      })
      .catch(() => {
        // Silent. The page still works in UTC; the next view tries again.
      });

    return () => {
      cancelled = true;
    };
  }, [current, router]);

  return null;
}
