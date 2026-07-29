import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requestOrigin } from "@/lib/request-origin";
import { db } from "@/lib/db";
import { reflections } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (session.userId) {
    await db
      .update(reflections)
      .set({ endedAt: new Date() })
      .where(and(eq(reflections.userId, session.userId), isNull(reflections.endedAt)));
  }

  session.destroy();
  return NextResponse.redirect(new URL("/login", requestOrigin(req)), 303);
}
