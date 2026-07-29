import { createHash } from "crypto";

const required = [
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "EMAIL_HMAC_KEY",
  "SESSION_SECRET",
] as const;

/** iron-session requires ≥32 characters and throws on the first getSession() otherwise. */
const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * First 8 hex characters of SHA-256(key).
 *
 * Safe to log: SHA-256 is one-way, and 8 of 64 hex characters is far too little
 * to attack a 32-byte key. What it buys is the ability to confirm at a glance
 * that the key deployed to Vercel is the same one that encrypted the data
 * locally.
 *
 * This matters because a key mismatch is otherwise nearly silent. A wrong
 * ENCRYPTION_KEY surfaces as a 500 on login (auth decrypts the email unguarded),
 * but a wrong EMAIL_HMAC_KEY has no tell at all — every login just returns
 * "invalid credentials", indistinguishable from a wrong password, and every
 * account appears not to exist.
 */
function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Copy .env.example to .env.local and fill in the values.`
    );
  }

  const hexKey = /^[0-9a-f]{64}$/i;

  if (!hexKey.test(process.env.ENCRYPTION_KEY!)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (!hexKey.test(process.env.EMAIL_HMAC_KEY!)) {
    throw new Error(
      "EMAIL_HMAC_KEY must be a 64-character hex string (32 bytes). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (process.env.SESSION_SECRET!.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters. ` +
        "iron-session enforces this itself, but only on the first getSession() " +
        "call — which means a short secret boots fine and fails on a user's " +
        "first request. Failing here instead.\n" +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
}

validateEnv();

// One line per process start. Compare across environments to confirm the keys
// match before trusting that data written in one is readable in the other.
// Never logs key material — see fingerprint().
console.log(
  JSON.stringify({
    event: "env_key_fingerprints",
    encryptionKey: fingerprint(process.env.ENCRYPTION_KEY!),
    emailHmacKey: fingerprint(process.env.EMAIL_HMAC_KEY!),
  })
);

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  encryptionKey: process.env.ENCRYPTION_KEY!,
  emailHmacKey: process.env.EMAIL_HMAC_KEY!,
  sessionSecret: process.env.SESSION_SECRET!,
} as const;

/**
 * Returns the Anthropic API key, validated at call time.
 * Kept separate from env so CLI scripts (seed, migrations) don't fail
 * when ANTHROPIC_API_KEY is absent — they never need it.
 * Server-side only. Never log, expose in errors, or send to the browser.
 */
export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in .env.local");
  return key;
}
