import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, journalEntrySummaries } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import {
  MAX_PEOPLE,
  MAX_SUMMARY_CHARS,
  MAX_TOPICS,
  type EntrySummary,
} from "@/lib/summaries/types";
import { authoritativeSummary } from "@/lib/summaries/read";

/**
 * The user's correction to an entry's summary.
 *
 * PUT    save a correction
 * DELETE discard it and go back to the AI's version
 *
 * ── The correction is written to its own column ───────────────────────────────
 * `encrypted_user_content`, which the summarisation queue never writes to. That
 * is what makes this safe: regenerating a summary — because the entry was edited
 * or the prompt changed — overwrites `encrypted_content` and cannot touch the
 * correction. No special case in the worker, nothing to remember.
 *
 * Ownership is re-checked against the entry, not the summary. `id` is the entry
 * id from the URL and is untrusted.
 */

type Params = { params: Promise<{ id: string }> };

/** Loads the summary only if its entry belongs to the caller. */
async function loadOwned(entryId: string, userId: string) {
  const [row] = await db
    .select({
      summaryId: journalEntrySummaries.id,
      encryptedContent: journalEntrySummaries.encryptedContent,
      encryptedUserContent: journalEntrySummaries.encryptedUserContent,
      userEditedAt: journalEntrySummaries.userEditedAt,
      generatedAt: journalEntrySummaries.generatedAt,
      generationVersion: journalEntrySummaries.generationVersion,
      purgedAt: journalEntries.purgedAt,
    })
    .from(journalEntrySummaries)
    .innerJoin(
      journalEntries,
      eq(journalEntries.id, journalEntrySummaries.journalEntryId)
    )
    .where(
      and(
        eq(journalEntrySummaries.journalEntryId, entryId),
        eq(journalEntries.userId, userId)
      )
    )
    .limit(1);
  return row ?? null;
}

function cleanList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { summary, topics, people } = payload as {
    summary?: unknown;
    topics?: unknown;
    people?: unknown;
  };

  if (typeof summary !== "string" || !summary.trim()) {
    return new Response("A summary cannot be empty", { status: 400 });
  }

  const row = await loadOwned(id, session.userId);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.purgedAt) return new Response("Gone", { status: 410 });

  // Quotes are not user-editable and are carried across unchanged: they are
  // verbatim fragments of the entry with offsets into it, so an edited "quote"
  // would be neither verbatim nor locatable, and the guarantee that a quote is
  // the writer's own words is the only thing that makes them worth storing.
  let existing;
  try {
    existing = authoritativeSummary(row);
  } catch {
    return new Response("This summary could not be read", { status: 409 });
  }

  const corrected: EntrySummary = {
    summary: summary.trim().slice(0, MAX_SUMMARY_CHARS),
    topics: cleanList(topics, MAX_TOPICS),
    people: cleanList(people, MAX_PEOPLE),
    quotes: existing.aiOriginal.quotes,
    // A corrected summary is by definition no longer the model's judgement of
    // how thin the entry was.
    thin: false,
  };

  await db
    .update(journalEntrySummaries)
    .set({
      encryptedUserContent: encrypt(JSON.stringify(corrected)),
      userEditedAt: new Date(),
    })
    .where(eq(journalEntrySummaries.id, row.summaryId));

  return Response.json({ savedAt: new Date().toISOString() });
}

/** Discards the correction. The AI version becomes authoritative again. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  const row = await loadOwned(id, session.userId);
  if (!row) return new Response("Not found", { status: 404 });

  await db
    .update(journalEntrySummaries)
    .set({ encryptedUserContent: null, userEditedAt: null })
    .where(eq(journalEntrySummaries.id, row.summaryId));

  return new Response(null, { status: 204 });
}
