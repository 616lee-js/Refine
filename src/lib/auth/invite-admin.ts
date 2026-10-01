import "server-only";

import { randomUUID, randomInt } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { inviteCodes } from "@/lib/db/schema";
import { normalizeInviteCode } from "./index";

/**
 * Invite codes, from the app rather than the command line.
 *
 * ── Why this exists alongside scripts/invite-codes.ts ─────────────────────────
 * Generating an invite meant opening a terminal on the machine with `.env.local`
 * on it. The product owner asked to manage codes from the admin account instead,
 * which means the logic has to live in the bundle rather than in a script.
 *
 * The CLI stays. It needs no session, which matters when the thing that is broken
 * is the ability to sign in, and it is the documented path in
 * `docs/refine_operations.md`. Both write the same table and neither knows about
 * the other.
 *
 * ── Codes stay in the clear here, unlike reset codes ──────────────────────────
 * An invite code creates an account and nothing else. A stolen one costs a row in
 * a closed beta; a stolen *reset* code costs someone's journal, which is why that
 * one is hashed. Stated because the difference looks like an inconsistency.
 */

/** Same alphabet as the CLI: no 0/O, no 1/I/L, no U. Read aloud and hand-typed. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/** Upper bound per request. The CLI allows 100; a form has no reason to. */
export const MAX_INVITES_PER_REQUEST = 20;

function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let chunk = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      chunk += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

/**
 * Creates invite codes and returns them.
 *
 * `expiresDays` of null means no expiry, matching the CLI's default. An invite
 * that never expires is defensible in a way a reset code that never expires is
 * not: it only ever creates an account.
 */
export async function createInviteCodes(
  count: number,
  { expiresDays, note }: { expiresDays: number | null; note: string | null }
): Promise<string[]> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INVITES_PER_REQUEST) {
    throw new Error(`Count must be between 1 and ${MAX_INVITES_PER_REQUEST}.`);
  }
  if (expiresDays !== null && (!Number.isInteger(expiresDays) || expiresDays < 1)) {
    throw new Error("Expiry must be a whole number of days, or none.");
  }

  const expiresAt =
    expiresDays === null ? null : new Date(Date.now() + expiresDays * 86_400_000);

  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await db.insert(inviteCodes).values({
      id: randomUUID(),
      code,
      note: note?.trim() || null,
      expiresAt,
    });
    created.push(code);
  }
  return created;
}

export type InviteRow = {
  code: string;
  note: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
};

/**
 * Codes, newest first.
 *
 * `used_by_user_id` is deliberately not selected. Which account consumed which
 * invite is not needed to decide whether a code is spent, and this page has no
 * reason to tie a person to a code.
 */
export async function listInviteCodes(limit = 100): Promise<InviteRow[]> {
  return db
    .select({
      code: inviteCodes.code,
      note: inviteCodes.note,
      createdAt: inviteCodes.createdAt,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
      revokedAt: inviteCodes.revokedAt,
    })
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt))
    .limit(limit);
}

/**
 * Revokes an unused code. Returns false when there was nothing to revoke.
 *
 * A used code is left alone: revoking it would not un-create the account, and the
 * row is the record that it was spent.
 */
export async function revokeInviteCode(raw: string): Promise<boolean> {
  const code = normalizeInviteCode(raw);
  // `used_at IS NULL` is in the WHERE, not checked afterwards. Updating first and
  // reporting second would stamp `revoked_at` on a code that had already created
  // an account, which is a false record of something that never happened.
  const rows = await db
    .update(inviteCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedAt)))
    .returning({ code: inviteCodes.code });

  return rows.length > 0;
}

/** Codes neither used, revoked, nor expired — what is actually handable today. */
export async function countLiveInvites(): Promise<number> {
  const rows = await db
    .select({ expiresAt: inviteCodes.expiresAt })
    .from(inviteCodes)
    .where(and(isNull(inviteCodes.usedAt), isNull(inviteCodes.revokedAt)));

  const now = new Date();
  return rows.filter((r) => !r.expiresAt || r.expiresAt > now).length;
}
