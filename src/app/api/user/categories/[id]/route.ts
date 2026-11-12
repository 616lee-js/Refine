import { getSession } from "@/lib/auth";
import {
  cleanCategoryName,
  deleteCategory,
  findCategory,
  MAX_CATEGORY_NAME_CHARS,
  renameCategory,
} from "@/lib/journal/categories";

/**
 * One of the person's categories. See lib/journal/categories.ts.
 *
 * PATCH  rename it.
 * DELETE remove it from every entry and delete it. The entries stay.
 *
 * Both answer 404 for a category that is not theirs — never 403, which would
 * confirm the id exists.
 */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
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

  // Renaming onto a name another category already has would leave two with
  // one name — refused, with the clash named, rather than silently merged.
  const clash = await findCategory(session.userId, name);
  if (clash && clash.id !== id) {
    return new Response("Another category already has that name", { status: 409 });
  }

  const ok = await renameCategory(session.userId, id, name);
  if (!ok) return new Response("Not found", { status: 404 });
  return Response.json({ id, name });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  const ok = await deleteCategory(session.userId, id);
  if (!ok) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
