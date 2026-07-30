import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";

/**
 * Sign out.
 *
 * Under the chat model this force-ended every open reflection on the way out,
 * because an unfinished conversation had no meaning once you left. Journal
 * entries are the opposite: an unfinished entry is a **draft**, and the user is
 * meant to be able to come back to it. Closing them here would destroy exactly
 * the thing autosave exists to protect — so signing out now leaves drafts alone.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/login", requestOrigin(req)), 303);
}
