import { NextRequest, NextResponse } from "next/server";
import { registerUser, getSession } from "@/lib/auth";

function origin(req: NextRequest) {
  return `http://${req.headers.get("host")}`;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const displayName = formData.get("displayName");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof displayName !== "string" ||
    !email ||
    !password ||
    !displayName
  ) {
    return NextResponse.redirect(new URL("/signup?error=1", origin(req)));
  }

  if (password.length < 8) {
    return NextResponse.redirect(new URL("/signup?error=1", origin(req)));
  }

  try {
    const user = await registerUser(email, password, displayName);

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    return NextResponse.redirect(new URL("/onboarding", origin(req)));
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_IN_USE") {
      return NextResponse.redirect(
        new URL("/signup?error=email_in_use", origin(req))
      );
    }
    return NextResponse.redirect(new URL("/signup?error=1", origin(req)));
  }
}
