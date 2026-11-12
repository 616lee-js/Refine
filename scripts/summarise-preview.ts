import { Client } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";
import { decrypt } from "../src/lib/crypto";
import { generateSummary, SUMMARISER_VERSION } from "../src/lib/summaries/generate";

/**
 * Run the summariser as it is in the working tree over a few real entries, and
 * print what it would store. Stores nothing.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Every summariser change is approved against sample output before it runs —
 * the package's rule for this round. A new version applies to entries submitted
 * or edited after it ships (nothing already summarised is redone), so the only
 * way to see what it would write beforehand is to run it here, on real entries,
 * and store nothing.
 *
 *   npm run summarise:preview -- <user-id-prefix> [count]
 *
 * Needs ANTHROPIC_API_KEY and ENCRYPTION_KEY in .env.local. One Haiku call per
 * entry. Prints the summariser's reply, which describes the entry, and nothing
 * of the entry itself beyond its date and length.
 */

function connect(): Client {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT is not set.");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new Client({
    connectionString: url,
    ssl: local ? undefined : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  });
}

async function main() {
  const [prefix, countArg] = process.argv.slice(2);
  const n = Math.max(1, Math.min(10, Number(countArg) || 3));
  if (!prefix) {
    console.error("Usage: npm run summarise:preview -- <user-id-prefix> [count]");
    process.exit(1);
  }

  const c = connect();
  await c.connect();
  try {
    const { rows: users } = await c.query<{ id: string }>(
      `SELECT id FROM users WHERE id LIKE $1 || '%'`,
      [prefix]
    );
    if (users.length !== 1) {
      console.error(`${users.length} accounts match "${prefix}". Give a longer prefix.`);
      process.exit(1);
    }

    const { rows } = await c.query<{ id: string; completed_at: Date; encrypted_body: string }>(
      `SELECT id, completed_at, encrypted_body FROM journal_entries
        WHERE user_id = $1 AND completed_at IS NOT NULL
          AND deleted_at IS NULL AND purged_at IS NULL AND encrypted_body IS NOT NULL
        ORDER BY completed_at DESC LIMIT $2`,
      [users[0].id, n]
    );

    console.log(`summariser ${SUMMARISER_VERSION} — ${rows.length} entries, nothing stored\n`);

    for (const r of rows) {
      const body = decrypt(r.encrypted_body);
      console.log("─".repeat(70));
      console.log(`entry ${r.id.slice(0, 8)} · ${r.completed_at.toISOString().slice(0, 10)} · ${body.length} characters`);
      const s = await generateSummary(body);
      console.log(`\nsummary: ${s.summary}`);
      console.log(`topics:  ${s.topics.join(" · ") || "(none)"}`);
      console.log(`people:  ${s.people.join(" · ") || "(none)"}`);
      console.log(`quotes:  ${s.quotes.length}`);
      console.log(`thin:    ${s.thin}\n`);
    }
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
