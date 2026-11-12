import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { setEntryCategories } from "@/lib/journal/categories";

/**
 * Which of the person's categories an entry carries.
 *
 * PUT replaces the whole set — `{ categoryIds: string[] }`. The client sends
 * what the entry should have after the change, so adding and removing are the
 * same request and a stale screen cannot resurrect a removed one.
 */

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { categoryIds } = body as { categoryIds?: unknown };
  if (
    !Array.isArray(categoryIds) ||
    categoryIds.some((c) => typeof c !== "string")
  ) {
    return new Response("categoryIds must be a list of ids", { status: 400 });
  }

  // Ownership first; `id` comes from the URL and is untrusted.
  const [entry] = await db
    .select({ id: journalEntries.id, purgedAt: journalEntries.purgedAt })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, session.userId)))
    .limit(1);
  if (!entry) return new Response("Not found", { status: 404 });
  if (entry.purgedAt) return new Response("Gone", { status: 410 });

  await setEntryCategories(session.userId, id, categoryIds as string[]);
  return new Response(null, { status: 204 });
}
