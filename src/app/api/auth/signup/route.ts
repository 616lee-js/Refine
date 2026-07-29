import { NextRequest, NextResponse } from "next/server";
import {
  registerUser,
  getSession,
  SignupError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";

function origin(req: NextRequest) {
  return `http://${req.headers.get("host")}`;
}

/** Maps a failure to the ?error= value the signup page renders a message for. */
const ERROR_CODES: Record<string, string> = {
  EMAIL_IN_USE: "email_in_use",
  INVITE_NOT_FOUND: "invite_invalid",
  INVITE_ALREADY_USED: "invite_used",
  INVITE_EXPIRED: "invite_expired",
  INVITE_REVOKED: "invite_invalid",
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const displayName = formData.get("displayName");
  const inviteCode = formData.get("inviteCode");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof displayName !== "string" ||
    typeof inviteCode !== "string" ||
    !email ||
    !password ||
    !displayName ||
    !inviteCode
  ) {
    return NextResponse.redirect(new URL("/signup?error=1", origin(req)));
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.redirect(new URL("/signup?error=password_short", origin(req)));
  }

  try {
    const user = await registerUser(email, password, displayName, inviteCode);

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    return NextResponse.redirect(new URL("/onboarding", origin(req)));
  } catch (err) {
    // A revoked code reports as generically invalid rather than confirming it
    // once existed. Used and expired are distinguished because the person
    // holding that code needs to know to ask for a new one.
    if (err instanceof SignupError) {
      const code = ERROR_CODES[err.reason] ?? "1";
      return NextResponse.redirect(new URL(`/signup?error=${code}`, origin(req)));
    }
    console.error("Signup failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/signup?error=1", origin(req)));
  }
}
