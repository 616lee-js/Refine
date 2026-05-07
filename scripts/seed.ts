/**
 * First-time setup: creates the initial user account.
 * Usage: npm run setup:seed -- "Display Name" "email@example.com" "password"
 *
 * Requires DATABASE_URL, ENCRYPTION_KEY, EMAIL_HMAC_KEY in .env
 */
import { registerUser } from "../src/lib/auth";

async function seed() {
  const [, , displayName, email, password] = process.argv;

  if (!displayName || !email || !password) {
    console.error(
      "Usage: npm run setup:seed -- \"Display Name\" \"email@example.com\" \"password\""
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await registerUser(email, password, displayName);
  console.log(`User created: "${user.displayName}" (id: ${user.id})`);
  console.log("Start the app: npm run dev");
  process.exit(0);
}

seed().catch((err) => {
  if (err instanceof Error && err.message === "EMAIL_IN_USE") {
    console.error("A user with that email already exists.");
  } else {
    console.error(err);
  }
  process.exit(1);
});
