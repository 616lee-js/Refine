import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { classifyAndLog } from "@/lib/safety/classify-and-log";

/**
 * A single journal entry.
 *
 * PUT   autosave the body, and optionally the title. No classification — drafts
 *       are saved constantly and classifying on every keystroke pause would be
 *       pointless and expensive.
 * PATCH mark complete (or re-save an already-complete entry). Classification
 *       runs here, and the tier comes back so the client can surface resources.
 * DELETE move to trash.
 *
 * Every handler re-checks ownership. `id` comes from the URL, so it is untrusted.
 */

type Params = { params: Promise<{ id: string }> };

/** Loads the entry only if it belongs to the caller. */
async function loadOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .limit(1);
  return row ?? null;
}

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

  // Either field may travel alone. A title-only PUT is what the read view sends
  // when someone names an entry after the fact — it must not have to round-trip
  // the whole body back to the server to do that.
  const { text, title } = body as { text?: unknown; title?: unknown };
  const hasText = typeof text === "string";
  const hasTitle = typeof title === "string";
  if (!hasText && !hasTitle) {
    return new Response("text or title required", { status: 400 });
  }

  const entry = await loadOwned(id, session.userId);
  if (!entry) return new Response("Not found", { status: 404 });

  // A purged entry is a bookkeeping shell — its content was destroyed
  // deliberately and must not come back to life through an autosave.
  if (entry.purgedAt) return new Response("Gone", { status: 410 });
  if (entry.deletedAt) return new Response("In trash", { status: 409 });

  await db
    .update(journalEntries)
    .set({
      // Empty text stores NULL rather than the ciphertext of "" — it keeps
      // "never written" and "written then cleared" the same shape.
      ...(hasText
        ? {
            encryptedBody: (text as string).length > 0 ? encrypt(text as string) : null,
            // New content deserves fresh summarisation attempts. The summary
            // itself is not invalidated here — the queue derives staleness from
            // updated_at, so bumping that is enough.
            summaryAttempts: 0,
          }
        : {}),
      // A title summarises the entry, so it is content and encrypted like the
      // body. Absent means "leave as is"; empty string means "clear it".
      ...(hasTitle
        ? {
            encryptedTitle: (title as string).trim()
              ? encrypt((title as string).trim())
              : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(journalEntries.id, id));

  return Response.json({ savedAt: new Date().toISOString() });
}

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

  const { text, title } = body as { text?: unknown; title?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    return new Response("Cannot complete an empty entry", { status: 400 });
  }

  const entry = await loadOwned(id, session.userId);
  if (!entry) return new Response("Not found", { status: 404 });
  if (entry.purgedAt) return new Response("Gone", { status: 410 });
  if (entry.deletedAt) return new Response("In trash", { status: 409 });

  const wasAlreadyComplete = entry.completedAt !== null;
  const now = new Date();

  await db
    .update(journalEntries)
    .set({
      encryptedBody: encrypt(text),
      summaryAttempts: 0,
      ...(typeof title === "string"
        ? { encryptedTitle: title.trim() ? encrypt(title.trim()) : null }
        : {}),
      completedAt: entry.completedAt ?? now,
      updatedAt: now,
    })
    .where(eq(journalEntries.id, id));

  // Classification is awaited, not backgrounded: the response carries the tier,
  // and the client renders crisis resources from it. Deferring it would mean the
  // user finishes an entry containing acute content and sees nothing.
  //
  // Chunked by paragraph with the max taken — see src/lib/safety/chunk.ts for
  // why a single call over a long entry dilutes a buried signal.
  const tier = await classifyAndLog({
    userId: session.userId,
    journalEntryId: id,
    text,
    source: wasAlreadyComplete ? "journal_edit" : "journal_entry",
  });

  await db
    .update(journalEntries)
    .set({ tierClassification: tier, classifiedAt: now })
    .where(eq(journalEntries.id, id));

  return Response.json({ tier, completedAt: (entry.completedAt ?? now).toISOString() });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  const entry = await loadOwned(id, session.userId);
  if (!entry) return new Response("Not found", { status: 404 });

  // Trash, not deletion. Purge happens after 30 days, or immediately if the user
  // asks for it from the trash view.
  await db
    .update(journalEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(journalEntries.id, id));

  return new Response(null, { status: 204 });
}
