/**
 * One-time setup script: generates a bcrypt hash of your chosen passphrase.
 * Run with: npm run setup:passphrase
 * Paste the output into AUTH_PASSPHRASE_HASH in .env.local
 */
import { hash } from "bcryptjs";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question("Enter your passphrase: ", async (passphrase) => {
  rl.close();
  if (!passphrase || passphrase.length < 8) {
    console.error("Passphrase must be at least 8 characters.");
    process.exit(1);
  }
  const hashed = await hash(passphrase, 12);
  // Escape $ signs — Next.js env parser expands $VAR otherwise
  const escaped = hashed.replace(/\$/g, "\\$");
  console.log("\nAdd this to your .env.local and .env:\n");
  console.log(`AUTH_PASSPHRASE_HASH=${escaped}`);
});
