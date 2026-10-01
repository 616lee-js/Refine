import { NextRequest, NextResponse } from "next/server";
import { loginUser, getSession } from "@/lib/auth";
import {
  clearAttemptsForAddress,
  isAddressLockedOut,
  recordFailureForAddress,
} from "@/lib/auth/recovery";
import { requestOrigin } from "@/lib/request-origin";
import {
  APPEARANCE_COOKIE_OPTIONS,
  MODE_COOKIE,
  PALETTE_COOKIE,
  readMode,
  readPalette,
} from "@/lib/appearance";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return NextResponse.redirect(new URL("/login?error=1", requestOrigin(req)), 303);
  }

  /*
   * Throttle. There was none at all: a wrong password was a bare redirect, with
   * nothing counting and nothing slowing down.
   *
   * Checked before the password is verified, so a locked address costs no bcrypt
   * work. The lockout reports as the same generic error as a wrong password —
   * saying "this address is locked" would confirm the address has an account, and
   * the counter deliberately covers addresses with no account for that reason.
   * See lib/auth/recovery.ts.
   */
  if (await isAddressLockedOut(email)) {
    return NextResponse.redirect(new URL("/login?error=1", requestOrigin(req)), 303);
  }

  const user = await loginUser(email, password);
  if (!user) {
    await recordFailureForAddress(email);
    return NextResponse.redirect(new URL("/login?error=1", requestOrigin(req)), 303);
  }

  // Proved who they are, so the count goes.
  await clearAttemptsForAddress(email);

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  const res = NextResponse.redirect(new URL("/", requestOrigin(req)), 303);

  /*
   * Carry the stored appearance onto this device.
   *
   * The root layout paints from cookies, so without this a returning user on a
   * new browser would sign in and land on Dawn light regardless of what they
   * chose — their preference intact in the database and invisible until they
   * went and set it again.
   *
   * Written on the redirect itself rather than through cookies(), because this
   * handler returns a NextResponse and that is where its jar lives.
   */
  const prefs =
    user.preferences && typeof user.preferences === "object"
      ? (user.preferences as Record<string, unknown>)
      : {};

  res.cookies.set(
    PALETTE_COOKIE,
    readPalette(prefs.palette),
    APPEARANCE_COOKIE_OPTIONS
  );
  res.cookies.set(MODE_COOKIE, readMode(prefs.mode), APPEARANCE_COOKIE_OPTIONS);

  return res;
}
