/**
 * Invite code management.
 *
 *   npm run invites -- generate <n> [--expires <days>] [--note "text"]
 *   npm run invites -- list
 *   npm run invites -- revoke <CODE>
 *   npm run invites -- whoami <email@example.com>
 *
 * Local (reads .env):
 *   npm run invites -- list
 *
 * Against production — pass the Supabase DIRECT connection string, never the
 * pooled one. This is interactive admin work and wants a real session:
 *   DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres?sslmode=require" \
 *     npx tsx scripts/invite-codes.ts list
 */
import { randomInt } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { inviteCodes, users } from "../src/lib/db/schema";
import { computeEmailHmac, normalizeInviteCode } from "../src/lib/auth";
import { adminUserIds } from "../src/lib/auth/admin";

/**
 * Crockford-style alphabet: no 0/O, no 1/I/L, no U. These codes get read aloud,
 * typed off a phone screen, and copied by hand — the ambiguous characters are
 * where that goes wrong.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP = 4;
const GROUPS = 3;

function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let chunk = "";
    for (let i = 0; i < GROUP; i++) {
      chunk += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

async function generate() {
  const count = Number(process.argv[3] ?? "1");
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    console.error("Count must be an integer between 1 and 100.");
    process.exit(1);
  }

  const expiresDays = arg("--expires");
  const note = arg("--note") ?? null;

  let expiresAt: Date | null = null;
  if (expiresDays !== undefined) {
    const days = Number(expiresDays);
    if (!Number.isInteger(days) || days < 1) {
      console.error("--expires must be a positive integer number of days.");
      process.exit(1);
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const { randomUUID } = await import("crypto");
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await db.insert(inviteCodes).values({
      id: randomUUID(),
      code,
      note,
      expiresAt,
      createdAt: new Date(),
    });
    created.push(code);
  }

  console.log(`\nCreated ${created.length} invite code${created.length === 1 ? "" : "s"}:\n`);
  for (const c of created) console.log(`  ${c}`);
  console.log(
    `\n  expires: ${expiresAt ? fmtDate(expiresAt) : "never"}${note ? `\n  note:    ${note}` : ""}\n`
  );
}

async function list() {
  const rows = await db
    .select({
      code: inviteCodes.code,
      note: inviteCodes.note,
      createdAt: inviteCodes.createdAt,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
      revokedAt: inviteCodes.revokedAt,
      usedByUserId: inviteCodes.usedByUserId,
      usedByName: users.displayName,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.usedByUserId, users.id))
    .orderBy(desc(inviteCodes.createdAt));

  if (rows.length === 0) {
    console.log("\nNo invite codes yet. Create one:  npm run invites -- generate 1\n");
    return;
  }

  const admins = adminUserIds();
  const now = Date.now();

  console.log("");
  console.log(
    "CODE            STATUS      USED BY                        EXPIRES     NOTE"
  );
  console.log("-".repeat(100));

  for (const r of rows) {
    let status: string;
    if (r.revokedAt) status = "revoked";
    else if (r.usedAt) status = "used";
    else if (r.expiresAt && r.expiresAt.getTime() < now) status = "expired";
    else status = "available";

    // Flag the admin account's code explicitly — it is the one you must not
    // lose track of, and it is otherwise indistinguishable from a tester's.
    const isAdmin = r.usedByUserId !== null && admins.includes(r.usedByUserId);
    const usedBy = r.usedByName
      ? `${r.usedByName}${isAdmin ? "  [ADMIN]" : ""}`
      : "—";

    console.log(
      r.code.padEnd(15) +
        status.padEnd(12) +
        usedBy.padEnd(31) +
        fmtDate(r.expiresAt).padEnd(12) +
        (r.note ?? "")
    );
  }
  console.log("");
}

async function revoke() {
  const raw = process.argv[3];
  if (!raw) {
    console.error("Usage: npm run invites -- revoke <CODE>");
    process.exit(1);
  }
  const code = normalizeInviteCode(raw);

  const [existing] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!existing) {
    console.error(`No such code: ${code}`);
    process.exit(1);
  }
  if (existing.usedAt) {
    // Revoking after use would misrepresent history — the account already exists.
    console.error(`${code} has already been used; revoking it would change nothing.`);
    process.exit(1);
  }
  if (existing.revokedAt) {
    console.log(`${code} was already revoked on ${fmtDate(existing.revokedAt)}.`);
    return;
  }

  await db
    .update(inviteCodes)
    .set({ revokedAt: new Date() })
    .where(eq(inviteCodes.id, existing.id));

  console.log(`Revoked ${code}.`);
}

/**
 * Resolve an email to its user id.
 *
 * Emails are stored encrypted and looked up by HMAC blind index, so plain SQL
 * on the email column cannot find an account. This is the supported way to get
 * the UUID for ADMIN_USER_IDS.
 */
async function whoami() {
  const email = process.argv[3];
  if (!email) {
    console.error("Usage: npm run invites -- whoami <email@example.com>");
    process.exit(1);
  }

  const hmac = computeEmailHmac(email);
  const [row] = await db
    .select({ id: users.id, displayName: users.displayName, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.emailHmac, hmac))
    .limit(1);

  if (!row) {
    console.error(
      `No account found for that email.\n` +
        `If you expected one, check that EMAIL_HMAC_KEY here matches the environment ` +
        `where the account was created — a different key produces a different lookup ` +
        `hash and the account will appear not to exist.`
    );
    process.exit(1);
  }

  const isAdmin = adminUserIds().includes(row.id);
  console.log("");
  console.log(`  name:     ${row.displayName}`);
  console.log(`  user id:  ${row.id}`);
  console.log(`  created:  ${fmtDate(row.createdAt)}`);
  console.log(`  admin:    ${isAdmin ? "yes" : "no (not in ADMIN_USER_IDS)"}`);
  console.log("");
  if (!isAdmin) {
    console.log("  To grant admin, set this in Vercel and redeploy:");
    console.log(`    ADMIN_USER_IDS=${row.id}`);
    console.log("");
  }
}

const COMMANDS: Record<string, () => Promise<void>> = {
  generate,
  list,
  revoke,
  whoami,
};

async function main() {
  const command = process.argv[2];
  const run = command ? COMMANDS[command] : undefined;

  if (!run) {
    console.error(
      "Usage:\n" +
        '  npm run invites -- generate <n> [--expires <days>] [--note "text"]\n' +
        "  npm run invites -- list\n" +
        "  npm run invites -- revoke <CODE>\n" +
        "  npm run invites -- whoami <email@example.com>"
    );
    process.exit(1);
  }

  await run();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
