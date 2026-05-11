import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (session.userId) {
    await db
      .update(sessions)
      .set({ endedAt: new Date() })
      .where(and(eq(sessions.userId, session.userId), isNull(sessions.endedAt)));
  }

  session.destroy();
  return NextResponse.redirect(new URL("/login", req.url));
}
