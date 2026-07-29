import { createHmac, timingSafeEqual } from "crypto";
import { hash, compare } from "bcryptjs";
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { encrypt, decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users, inviteCodes } from "@/lib/db/schema";

// ── Session ───────────────────────────────────────────────────────────────────

export interface SessionData {
  userId?: string;
}

const SESSION_OPTIONS = {
  password: env.sessionSecret,
  cookieName: "refine_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

// ── Email HMAC ────────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 of the normalised email (lowercased, trimmed).
 * Used for indexed login lookups — the encrypted email cannot be queried directly.
 * EMAIL_HMAC_KEY must never change once users exist.
 */
export function computeEmailHmac(email: string): string {
  const key = Buffer.from(env.emailHmacKey, "hex");
  return createHmac("sha256", key)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

// ── Password ──────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  plaintext: string,
  hashed: string
): Promise<boolean> {
  return compare(plaintext, hashed);
}

// ── User operations ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
}

/**
 * Look up user by HMAC-indexed email, decrypt to confirm match, verify password.
 * Returns null if not found or credentials are wrong.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const hmac = computeEmailHmac(email);

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.emailHmac, hmac))
    .limit(1);

  if (!row) return null;

  // Timing-safe email confirmation (guards against HMAC collision, however unlikely)
  const storedEmail = decrypt(row.emailEncrypted);
  const inputNorm = email.toLowerCase().trim();
  const storedNorm = storedEmail.toLowerCase().trim();

  if (
    inputNorm.length !== storedNorm.length ||
    !timingSafeEqual(Buffer.from(inputNorm), Buffer.from(storedNorm))
  ) {
    return null;
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return null;

  return { id: row.id, displayName: row.displayName, email: storedEmail };
}

/** Minimum password length. Raised from 8 when the app moved off local-only hosting. */
export const MIN_PASSWORD_LENGTH = 12;

/** Distinguishable failures, so signup can tell the user what actually went wrong. */
export type SignupFailure =
  | "EMAIL_IN_USE"
  | "INVITE_NOT_FOUND"
  | "INVITE_ALREADY_USED"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED";

export class SignupError extends Error {
  constructor(public readonly reason: SignupFailure) {
    super(reason);
    this.name = "SignupError";
  }
}

/** Codes are stored and compared uppercase, so the user can type them either way. */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Create a new user, consuming an invite code.
 *
 * The code check and the user insert run in ONE transaction with the code row
 * locked `FOR UPDATE`. Without the lock, two people submitting the same code
 * simultaneously would both read it as unused and both get an account — which
 * defeats the point of single-use codes, and the point of gating access at all.
 *
 * This is the codebase's first transaction. It is safe on the Supabase
 * transaction-mode pooler: the connection is pinned for the transaction's
 * duration.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  inviteCode: string
): Promise<AuthUser> {
  const hmac = computeEmailHmac(email);
  const normalizedCode = normalizeInviteCode(inviteCode);

  const { randomUUID } = await import("crypto");
  const id = randomUUID();
  const emailEncrypted = encrypt(email.trim());

  // Hash before opening the transaction — bcrypt at 12 rounds takes ~250ms and
  // holding a locked row for that long serialises concurrent signups needlessly.
  const passwordHash = await hashPassword(password);

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, normalizedCode))
      .limit(1)
      .for("update");

    if (!invite) throw new SignupError("INVITE_NOT_FOUND");
    if (invite.revokedAt) throw new SignupError("INVITE_REVOKED");
    if (invite.usedAt) throw new SignupError("INVITE_ALREADY_USED");
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new SignupError("INVITE_EXPIRED");
    }

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailHmac, hmac))
      .limit(1);

    if (existing) throw new SignupError("EMAIL_IN_USE");

    await tx.insert(users).values({
      id,
      emailEncrypted,
      emailHmac: hmac,
      displayName: displayName.trim(),
      passwordHash,
    });

    await tx
      .update(inviteCodes)
      .set({ usedAt: new Date(), usedByUserId: id })
      .where(eq(inviteCodes.id, invite.id));

    return { id, displayName: displayName.trim(), email: email.trim() };
  });
}
