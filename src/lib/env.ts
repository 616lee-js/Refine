const required = [
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "SESSION_SECRET",
  "AUTH_PASSPHRASE_HASH",
] as const;

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Copy .env.example to .env.local and fill in the values.`
    );
  }

  const key = process.env.ENCRYPTION_KEY!;
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
}

validateEnv();

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  encryptionKey: process.env.ENCRYPTION_KEY!,
  sessionSecret: process.env.SESSION_SECRET!,
  authPassphraseHash: process.env.AUTH_PASSPHRASE_HASH!,
} as const;
