import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { normalisePath } from "@/lib/feedback/pages";

/**
 * Product feedback submission.
 *
 * ── The session is checked and then thrown away ───────────────────────────────
 * This is NOT a forgotten `userId`. Authentication is here so the endpoint is
 * not an open target for anyone on the internet to fill the table with; the
 * identity is deliberately not written, so that saying "this is confusing"
 * costs nothing.
 *
 * See the `feedback` table comment in src/lib/db/schema.ts — in particular that
 * unattributed is not the same as unlinkable, and this must never be described
 * to a user as anonymity.
 */

/** Long enough for a real report, short enough not to be a storage vector. */
const MAX_BODY = 4000;

const TYPES = ["bug", "request"] as const;
type FeedbackType = (typeof TYPES)[number];

function isType(value: unknown): value is FeedbackType {
  return typeof value === "string" && TYPES.includes(value as FeedbackType);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { type, body, page } = payload as {
    type?: unknown;
    body?: unknown;
    page?: unknown;
  };

  if (!isType(type)) {
    return new Response("type must be \"bug\" or \"request\"", { status: 400 });
  }
  if (typeof body !== "string" || !body.trim()) {
    return new Response("Say something first", { status: 400 });
  }

  await db.insert(feedback).values({
    id: randomUUID(),
    type,
    // Trimmed and capped rather than rejected on length: someone who wrote a
    // very long report should not lose it to a validation error.
    body: body.trim().slice(0, MAX_BODY),
    // Resolved here, against an allowlist — the posted string is never stored.
    // A raw pathname would carry an entry id, tying an unattributed submission
    // to a specific piece of writing and through it to its author. An
    // unrecognised route records NULL. See src/lib/feedback/pages.ts.
    page: normalisePath(page),
  });

  return new Response(null, { status: 204 });
}
