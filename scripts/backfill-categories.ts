import { randomUUID } from "crypto";
import { Client } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";
import { encrypt } from "../src/lib/crypto";
import { authoritativeSummary } from "../src/lib/summaries/read";

/**
 * One-off: turn the summariser's old category labels into each person's own
 * starting categories.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Until 2026-11-11 the summariser sorted every entry into one of nine fixed
 * labels, stored inside the summary. Entry categories are the person's own now
 * (entry_categories + journal_entry_categories). The package says the labels
 * already on entries stay as the person's editable starting set; this creates
 * them. It reads the AUTHORITATIVE summary, so a label the person removed in a
 * correction is not put back.
 *
 * ── Run before the summariser changes ─────────────────────────────────────────
 * Summariser v4 rewrites `topics` as free phrases in the writer's words. Once
 * that has re-summarised the archive, the nine labels are gone from the
 * summaries and there is nothing here to read. Order matters.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 *   - Prints counts per label per account. Never prints an entry, a summary or
 *     a title. Writes nothing without --apply.
 *   - Only live entries: completed, not in trash, not purged.
 *   - Idempotent: a category with the same name (case-insensitive) is reused,
 *     and an entry already carrying it is skipped.
 *
 * Back up first: npm run backup
 *
 *   npm run categories:backfill            # show what would be created
 *   npm run categories:backfill -- --apply # create it
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

type SummaryRow = {
  user_id: string;
  journal_entry_id: string;
  encrypted_content: string;
  encrypted_user_content: string | null;
  user_edited_at: Date | null;
  generated_at: Date;
  generation_version: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const c = connect();
  await c.connect();

  try {
    const { rows } = await c.query<SummaryRow>(
      `SELECT j.user_id, s.journal_entry_id, s.encrypted_content,
              s.encrypted_user_content, s.user_edited_at, s.generated_at,
              s.generation_version
         FROM journal_entry_summaries s
         JOIN journal_entries j ON j.id = s.journal_entry_id
        WHERE j.completed_at IS NOT NULL
          AND j.deleted_at IS NULL AND j.purged_at IS NULL`
    );

    // user -> label (lowercased) -> { name as first seen, entry ids }
    const plan = new Map<string, Map<string, { name: string; entries: Set<string> }>>();
    let unreadable = 0;

    for (const r of rows) {
      let topics: string[];
      try {
        topics = authoritativeSummary({
          encryptedContent: r.encrypted_content,
          encryptedUserContent: r.encrypted_user_content,
          userEditedAt: r.user_edited_at,
          generatedAt: r.generated_at,
          generationVersion: r.generation_version,
        }).summary.topics;
      } catch {
        unreadable++;
        continue;
      }
      const byLabel = plan.get(r.user_id) ?? new Map();
      plan.set(r.user_id, byLabel);
      for (const raw of topics) {
        const name = raw.replace(/\s+/g, " ").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const entry = byLabel.get(key) ?? { name, entries: new Set<string>() };
        entry.entries.add(r.journal_entry_id);
        byLabel.set(key, entry);
      }
    }

    console.log(`\n${rows.length} live summaries read${unreadable ? `, ${unreadable} unreadable` : ""}.\n`);

    let categories = 0;
    let links = 0;
    for (const [userId, byLabel] of plan) {
      console.log(`account ${userId.slice(0, 8)}`);
      for (const [, v] of [...byLabel].sort((a, b) => b[1].entries.size - a[1].entries.size)) {
        console.log(`  ${v.name.padEnd(18)} ${String(v.entries.size).padStart(3)} entries`);
        categories++;
        links += v.entries.size;
      }
    }
    console.log(`\n${categories} categories, ${links} entry links, across ${plan.size} accounts.`);

    if (!apply) {
      console.log("\nNothing written. Re-run with --apply to create them.");
      console.log("Take a backup first if you have not: npm run backup\n");
      return;
    }

    // Idempotent apply. Names are ciphertext, so matching is done per account
    // after decrypting what exists — same as the app does.
    const { decrypt } = await import("../src/lib/crypto");
    let made = 0;
    let linked = 0;
    for (const [userId, byLabel] of plan) {
      const { rows: existing } = await c.query<{ id: string; encrypted_name: string }>(
        `SELECT id, encrypted_name FROM entry_categories WHERE user_id = $1`,
        [userId]
      );
      const idByLower = new Map<string, string>();
      for (const e of existing) {
        try {
          idByLower.set(decrypt(e.encrypted_name).toLowerCase(), e.id);
        } catch {
          /* unreadable existing name: never matched, never touched */
        }
      }
      for (const [key, v] of byLabel) {
        let id = idByLower.get(key);
        if (!id) {
          id = randomUUID();
          await c.query(
            `INSERT INTO entry_categories (id, user_id, encrypted_name) VALUES ($1, $2, $3)`,
            [id, userId, encrypt(v.name)]
          );
          idByLower.set(key, id);
          made++;
        }
        for (const entryId of v.entries) {
          const res = await c.query(
            `INSERT INTO journal_entry_categories (journal_entry_id, category_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [entryId, id]
          );
          linked += res.rowCount ?? 0;
        }
      }
    }
    console.log(`\nCreated ${made} categories and ${linked} entry links.\n`);
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
