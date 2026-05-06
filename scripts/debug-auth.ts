import { compare } from "bcryptjs";

async function main() {
  const hash = process.env.AUTH_PASSPHRASE_HASH ?? "(not set)";
  console.log("hash length:", hash.length);
  console.log("hash prefix:", hash.slice(0, 10));
  console.log("starts with $2b$:", hash.startsWith("$2b$"));
  console.log("starts with single quote:", hash.startsWith("'"));

  const testPassphrase = process.argv[2] ?? "";
  if (testPassphrase && hash.startsWith("$2b$")) {
    const ok = await compare(testPassphrase, hash);
    console.log("bcrypt compare result:", ok);
  }
}

main().catch(console.error);
