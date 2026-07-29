/**
 * Creates a user account from the command line.
 * Usage: npm run setup:seed -- "Display Name" "email@example.com" "password" "INVITE-CODE"
 *
 * Requires DATABASE_URL, ENCRYPTION_KEY, EMAIL_HMAC_KEY, SESSION_SECRET in .env
 *
 * An invite code is required here exactly as it is on the web signup form. This
 * script deliberately has no bypass: a second account-creation path that skipped
 * the gate would make the gate meaningless, and it would be the obvious thing to
 * reach for under time pressure. Generate a code first:
 *
 *   npm run invites -- generate 1 --note "seed account"
 */
import { registerUser, SignupError, MIN_PASSWORD_LENGTH } from "../src/lib/auth";

const FAILURE_MESSAGES: Record<string, string> = {
  EMAIL_IN_USE: "A user with that email already exists.",
  INVITE_NOT_FOUND: "That invite code does not exist.",
  INVITE_ALREADY_USED: "That invite code has already been used.",
  INVITE_EXPIRED: "That invite code has expired.",
  INVITE_REVOKED: "That invite code has been revoked.",
};

async function seed() {
  const [, , displayName, email, password, inviteCode] = process.argv;

  if (!displayName || !email || !password || !inviteCode) {
    console.error(
      'Usage: npm run setup:seed -- "Display Name" "email@example.com" "password" "INVITE-CODE"'
    );
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const user = await registerUser(email, password, displayName, inviteCode);
  console.log(`User created: "${user.displayName}" (id: ${user.id})`);
  console.log("Start the app: npm run dev");
  process.exit(0);
}

seed().catch((err) => {
  if (err instanceof SignupError) {
    console.error(FAILURE_MESSAGES[err.reason] ?? err.reason);
  } else {
    console.error(err);
  }
  process.exit(1);
});
