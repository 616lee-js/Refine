import { NextRequest, NextResponse } from "next/server";
import { loginUser, getSession } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";

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

  const user = await loginUser(email, password);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=1", requestOrigin(req)), 303);
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.redirect(new URL("/", requestOrigin(req)), 303);
}
