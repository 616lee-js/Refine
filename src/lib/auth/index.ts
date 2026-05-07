import { createHmac, timingSafeEqual } from "crypto";
import { hash, compare } from "bcryptjs";
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { encrypt, decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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

/**
 * Create a new user. Throws "EMAIL_IN_USE" if the email is already registered.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const hmac = computeEmailHmac(email);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailHmac, hmac))
    .limit(1);

  if (existing) throw new Error("EMAIL_IN_USE");

  const { randomUUID } = await import("crypto");
  const id = randomUUID();
  const emailEncrypted = encrypt(email.trim());
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    emailEncrypted,
    emailHmac: hmac,
    displayName: displayName.trim(),
    passwordHash,
  });

  return { id, displayName: displayName.trim(), email: email.trim() };
}
