import { randomUUID } from "crypto";
import { after } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog } from "@/lib/db/schema";
import {
  cleanCategoryName,
  createCategory,
  listCategories,
  MAX_CATEGORY_NAME_CHARS,
} from "@/lib/journal/categories";

/**
 * The person's own entry categories. See lib/journal/categories.ts.
 *
 * GET  every category with how many entries carry it.
 * POST create one, or return the one that already has that name.
 */

export async function GET() {
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });
  const userId = session.userId;

  const categories = await listCategories(userId);

  // Names are content and were decrypted to answer this. One row, with a count.
  if (categories.length > 0) {
    after(async () => {
      try {
        await db.insert(contentAccessLog).values({
          id: randomUUID(),
          userId,
          context: `categories_list (${categories.length} names read)`,
        });
      } catch (err) {
        console.error("Categories access log failed:", err instanceof Error ? err.message : err);
      }
    });
  }

  return Response.json({ categories });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const name = cleanCategoryName((body as { name?: unknown }).name);
  if (!name) {
    return new Response(`A name of 1–${MAX_CATEGORY_NAME_CHARS} characters is required`, {
      status: 400,
    });
  }

  const category = await createCategory(session.userId, name);
  return Response.json(category, { status: 201 });
}
