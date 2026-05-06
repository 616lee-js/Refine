import { NextRequest, NextResponse } from "next/server";
import { verifyPassphrase, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const passphrase = formData.get("passphrase");

  if (typeof passphrase !== "string" || passphrase.length === 0) {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }

  const valid = await verifyPassphrase(passphrase);
  if (!valid) {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }

  // Fetch the single user row (v1 has exactly one user)
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.redirect(new URL("/", req.url));
}
