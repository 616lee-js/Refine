import "server-only";

import { randomUUID, randomInt } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts, passwordResetCodes, users } from "@/lib/db/schema";
import {
  computeEmailHmac,
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "./index";

/**
 * Account recovery, and the throttle that has to come with it.
 *
 * ── Why codes rather than emailed links ───────────────────────────────────────
 * This app cannot send email — no mail dependency, no SMTP settings, no sending
 * domain. An admin generates a code, hands it over the way invite codes are
 * already handed over, and it works once. See the schema note on
 * `password_reset_codes` for why the code is stored hashed when invite codes are
 * not.
 */

/**
 * Crockford-style alphabet: no 0/O, no 1/I/L, no U.
 *
 * Same set as invite codes, for the same reason: these are read aloud, typed off
 * a phone screen and copied by hand, and the ambiguous characters are where that
 * goes wrong. Kept as its own copy rather than imported from `scripts/`, which is
 * CLI-only and not part of the app bundle.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/**
 * How long a reset code lives.
 *
 * 48 hours: long enough to hand over by message or in person across a time zone,
 * short enough that a code written down and forgotten stops working. Invite codes
 * may have no expiry at all; a reset code is a key to an account that already
 * holds someone's writing, so it always expires.
 */
export const RESET_CODE_HOURS = 48;

/** Failed attempts before an address is locked out. */
const MAX_FAILED_ATTEMPTS = 8;
/** How long the lock lasts. */
const LOCKOUT_MINUTES = 15;
/**
 * A quiet spell long enough that the count is no longer about one session.
 *
 * Without this, eight mistyped passwords spread over a month would lock someone
 * out — the count has to decay or it is a tally rather than a rate limit.
 */
const ATTEMPT_WINDOW_MINUTES = 60;

export function generateResetCode(): string {
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

/** Trim and upper-case, so case and stray spaces never cost someone a retry. */
export function normaliseResetCode(code: string): string {
  return code.trim().toUpperCase();
}

// ── Issuing ──────────────────────────────────────────────────────────────────

export type IssuedCode = {
  /** Shown to the admin once. Never stored, never recoverable. */
  code: string;
  expiresAt: Date;
};

/**
 * Issues a reset code for the account with this email address.
 *
 * Returns null when no such account exists. The caller decides what to say about
 * that — this is an admin-only surface, so telling the admin plainly is correct,
 * unlike the sign-in path where it would be an oracle.
 *
 * Any code already outstanding for the account is revoked first. Two live codes
 * for one account means a second spare key, and an admin issuing a replacement
 * has almost always decided the first one is lost.
 */
export async function issueResetCode(
  email: string,
  note: string | null
): Promise<IssuedCode | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailHmac, computeEmailHmac(email)))
    .limit(1);

  if (!user) return null;

  const code = generateResetCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + RESET_CODE_HOURS * 3_600_000);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetCodes)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(passwordResetCodes.userId, user.id),
          isNull(passwordResetCodes.usedAt),
          isNull(passwordResetCodes.revokedAt)
        )
      );

    await tx.insert(passwordResetCodes).values({
      id: randomUUID(),
      userId: user.id,
      codeHash,
      note: note?.trim() || null,
      expiresAt,
    });
  });

  return { code, expiresAt };
}

export type ResetCodeRow = {
  id: string;
  userId: string;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

/** Every reset code ever issued for one account, newest first. */
export async function listResetCodes(email: string): Promise<ResetCodeRow[] | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailHmac, computeEmailHmac(email)))
    .limit(1);

  if (!user) return null;

  return db
    .select({
      id: passwordResetCodes.id,
      userId: passwordResetCodes.userId,
      note: passwordResetCodes.note,
      createdAt: passwordResetCodes.createdAt,
      expiresAt: passwordResetCodes.expiresAt,
      usedAt: passwordResetCodes.usedAt,
      revokedAt: passwordResetCodes.revokedAt,
    })
    .from(passwordResetCodes)
    .where(eq(passwordResetCodes.userId, user.id))
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(50);
}

/** Revokes one code by id. Already-used codes are left alone — they are history. */
export async function revokeResetCode(id: string): Promise<void> {
  await db
    .update(passwordResetCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(passwordResetCodes.id, id), isNull(passwordResetCodes.usedAt)));
}

// ── Redeeming ────────────────────────────────────────────────────────────────

export type ResetFailure =
  | "INVALID"
  | "WEAK_PASSWORD"
  | "LOCKED";

export class ResetError extends Error {
  constructor(public readonly reason: ResetFailure) {
    super(reason);
    this.name = "ResetError";
  }
}

/**
 * Sets a new password, given an email and a code.
 *
 * ── One failure reason for everything that could be wrong ─────────────────────
 * Unknown address, wrong code, expired, revoked, already used — all `INVALID`.
 * Distinguishing them would tell an attacker which addresses have accounts and
 * which codes once existed. The admin who issued the code can see the real state;
 * the reset screen cannot.
 *
 * `WEAK_PASSWORD` and `LOCKED` are separable because neither says anything about
 * whether the account or the code exists.
 *
 * ── The same throttle as signing in ───────────────────────────────────────────
 * Guessing a 12-character code from a 30-letter alphabet is not feasible by hand,
 * but the throttle costs nothing and this is the one endpoint where a correct
 * guess hands over an account.
 */
export async function redeemResetCode(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const hmac = computeEmailHmac(email);

  if (await isLockedOut(hmac)) throw new ResetError("LOCKED");

  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    // Checked before the code is looked at, so a weak password does not burn the
    // code or count as a failed attempt.
    throw new ResetError("WEAK_PASSWORD");
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailHmac, hmac))
    .limit(1);

  if (!user) {
    await recordFailure(hmac);
    throw new ResetError("INVALID");
  }

  /*
   * Candidates, then compare. bcrypt is deliberately not searchable, so the code
   * cannot be looked up by its hash — the account is found first and its live
   * codes are compared one at a time. There is normally one, because issuing
   * revokes anything outstanding.
   */
  const now = new Date();
  const candidates = await db
    .select({
      id: passwordResetCodes.id,
      codeHash: passwordResetCodes.codeHash,
      expiresAt: passwordResetCodes.expiresAt,
    })
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.usedAt),
        isNull(passwordResetCodes.revokedAt)
      )
    )
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(5);

  const given = normaliseResetCode(code);
  let matched: string | null = null;
  for (const c of candidates) {
    if (c.expiresAt <= now) continue;
    if (await verifyPassword(given, c.codeHash)) {
      matched = c.id;
      break;
    }
  }

  if (!matched) {
    await recordFailure(hmac);
    throw new ResetError("INVALID");
  }

  const passwordHash = await hashPassword(newPassword);

  /*
   * One transaction: the code is spent and the password changes together.
   *
   * If these could come apart, the bad half is a spent code with the old password
   * still in place — the person is locked out and their only way back has been
   * consumed. The `used_at IS NULL` condition inside the update makes the spend
   * the thing that cannot happen twice, so two simultaneous redemptions cannot
   * both set a password.
   */
  await db.transaction(async (tx) => {
    const spent = await tx
      .update(passwordResetCodes)
      .set({ usedAt: now })
      .where(
        and(eq(passwordResetCodes.id, matched!), isNull(passwordResetCodes.usedAt))
      )
      .returning({ id: passwordResetCodes.id });

    if (spent.length === 0) throw new ResetError("INVALID");

    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  });

  // A successful reset clears the throttle: the person has proved who they are.
  await clearAttempts(hmac);
}

// ── Throttling ───────────────────────────────────────────────────────────────

/**
 * Whether this address is currently locked out.
 *
 * Takes the HMAC rather than the address so callers cannot accidentally pass a
 * raw email into something that writes a row.
 */
export async function isLockedOut(emailHmac: string): Promise<boolean> {
  const [row] = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(eq(loginAttempts.emailHmac, emailHmac))
    .limit(1);

  return Boolean(row?.lockedUntil && row.lockedUntil > new Date());
}

/** Same check, from an address. */
export function isAddressLockedOut(email: string): Promise<boolean> {
  return isLockedOut(computeEmailHmac(email));
}

/**
 * Counts one failure, and locks the address once the count passes the threshold.
 *
 * The count decays: a failure more than `ATTEMPT_WINDOW_MINUTES` after the last
 * one starts again at 1, so eight typos spread over a month do not lock anyone
 * out. Without that this is a lifetime tally rather than a rate limit.
 */
export async function recordFailure(emailHmac: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60_000);
  const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);

  /*
   * One statement, so two simultaneous failures cannot both read a count of 2 and
   * both write 3. `excluded` is the row this insert tried to add; the rest reads
   * the row already there.
   */
  /*
   * The `::timestamptz` casts are required, not tidiness.
   *
   * Inside a CASE, Postgres has nothing to infer a bare parameter's type from and
   * settles on text, so this failed with "column locked_until is of type timestamp
   * with time zone but expression is of type text" — on every wrong password,
   * which would have turned a mistyped password into a server error instead of the
   * sign-in page. Found by running it rather than by reading it.
   */
  await db
    .insert(loginAttempts)
    .values({ emailHmac, failedCount: 1, lastFailedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.emailHmac,
      set: {
        failedCount: sql`case
          when ${loginAttempts.lastFailedAt} < ${windowStart}::timestamptz then 1
          else ${loginAttempts.failedCount} + 1
        end`,
        lastFailedAt: now,
        lockedUntil: sql`case
          when ${loginAttempts.lastFailedAt} >= ${windowStart}::timestamptz
           and ${loginAttempts.failedCount} + 1 >= ${MAX_FAILED_ATTEMPTS}
          then ${lockedUntil}::timestamptz
          else null::timestamptz
        end`,
      },
    });
}

/** Called from a successful sign-in or reset. */
export async function clearAttempts(emailHmac: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.emailHmac, emailHmac));
}

export function clearAttemptsForAddress(email: string): Promise<void> {
  return clearAttempts(computeEmailHmac(email));
}

export function recordFailureForAddress(email: string): Promise<void> {
  return recordFailure(computeEmailHmac(email));
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
