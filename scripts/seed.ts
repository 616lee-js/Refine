/**
 * First-time setup: creates the single user row for v1.
 * Usage: npm run setup:seed -- "Your Name"
 * Or:    npm run setup:seed   (defaults to "James")
 */
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { randomBytes } from "crypto";

async function seed() {
  const displayName = process.argv[2] ?? "James";
  const id = randomBytes(16).toString("hex");

  await db.insert(users).values({ id, displayName }).onConflictDoNothing();
  console.log(`User created: "${displayName}" (id: ${id})`);
  console.log("Start the app: npm run dev");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
