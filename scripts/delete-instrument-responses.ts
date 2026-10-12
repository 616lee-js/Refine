import { Client } from "pg";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";

/**
 * One-off: permanently delete every response to one instrument.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Withdrawing an instrument normally means `shipped: false`, which stops it being
 * started while leaving past responses readable — the mechanism exists precisely
 * so history survives. Removing the instrument *file* is different: every surface
 * resolves an instrument by slug to know how to render an answer, so a response
 * to a slug nothing can resolve has nothing to render with.
 *
 * So when an instrument is genuinely going away, its responses go first.
 *
 * ── This is a hard delete, by the product owner's explicit choice ─────────────
 * Not trash. `questionnaire_responses` has `deleted_at` and `purged_at` and this
 * uses neither — the row is gone, and the only recovery is a backup file.
 *
 * **Run `npm run backup` first.** The script refuses to go further than a preview
 * without `--apply`, and prints every row it would delete.
 *
 *   npm run delete:instrument -- swls            # show what would go
 *   npm run delete:instrument -- swls --apply    # delete it
 *
 * ── What else the delete reaches, through the schema ──────────────────────────
 * Two other tables reference a response, and the two were given different
 * behaviour on purpose:
 *
 *   - `safety_log.questionnaire_response_id` is ON DELETE SET NULL. The
 *     classification record survives with its link cleared, which is correct:
 *     that something was classified at a tier is a safety record, not instrument
 *     data, and withdrawing an instrument must not destroy it.
 *   - `content_access_log.questionnaire_response_id` is ON DELETE CASCADE. Those
 *     audit rows go with the response. They record when its content was
 *     decrypted and shown, and there is nothing left for them to be about.
 *
 * Both are printed in the preview, before anything is deleted.
 */

type Row = {
  id: string;
  user_id: string;
  questionnaire_slug: string;
  questionnaire_version: string;
  completed_at: Date | null;
  deleted_at: Date | null;
  has_answers: boolean;
  tier: number | null;
};

function connect(): Client {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT is not set.");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new Client({
    connectionString: url,
    ssl: local
      ? undefined
      : { ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true },
  });
}

const day = (at: Date | null) => (at ? at.toISOString().slice(0, 10) : "—");

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const slug = args.find((a) => !a.startsWith("--"));

  if (!slug) {
    console.error(
      "Usage: npm run delete:instrument -- <slug> [--apply]\n" +
        "Run npm run backup first. This is a hard delete with no trash."
    );
    process.exit(1);
  }

  const c = connect();
  await c.connect();

  try {
    /*
     * Everything about the row except its content. The answers are encrypted and
     * there is no reason to decrypt them to delete them — the count of rows and
     * their dates is enough to confirm the right ones are going.
     */
    const { rows } = await c.query<Row>(
      `SELECT r.id, r.user_id, r.questionnaire_slug, r.questionnaire_version,
              r.completed_at, r.deleted_at,
              (r.encrypted_answers IS NOT NULL) AS has_answers,
              r.tier_classification AS tier
         FROM questionnaire_responses r
        WHERE r.questionnaire_slug = $1
        ORDER BY r.completed_at NULLS LAST`,
      [slug]
    );

    if (rows.length === 0) {
      console.log(`No responses to "${slug}". Nothing to do.`);
      return;
    }

    console.log(
      `\n${rows.length} response(s) to "${slug}" — THIS IS A PERMANENT DELETE:\n`
    );
    for (const r of rows) {
      console.log(
        `  ${r.id.slice(0, 8)}  account ${r.user_id.slice(0, 8)}  ` +
          `completed ${day(r.completed_at)}  version ${r.questionnaire_version}  ` +
          `answers ${r.has_answers ? "present" : "purged"}` +
          `${r.deleted_at ? "  (already in trash)" : ""}` +
          `${r.tier !== null ? `  tier ${r.tier}` : ""}`
      );
    }

    // Said plainly in the preview rather than left to be discovered after the
    // fact, because one of the two cascades.
    const classified = rows.filter((r) => r.tier !== null).length;
    if (classified > 0) {
      console.log(
        `\n  ${classified} of these were classified. Their safety_log rows survive\n` +
          `  with the link cleared — the classification is a safety record, not\n` +
          `  instrument data.`
      );
    }

    const ids = rows.map((r) => r.id);
    const { rows: access } = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM content_access_log
        WHERE questionnaire_response_id = ANY($1::text[])`,
      [ids]
    );
    const accessRows = Number(access[0]?.n ?? 0);
    if (accessRows > 0) {
      console.log(
        `\n  ${accessRows} content_access_log row(s) will be deleted with them —\n` +
          `  that reference cascades. They record when this content was decrypted\n` +
          `  and shown, and there is nothing left for them to be about.`
      );
    }

    if (!apply) {
      console.log(
        `\nNothing deleted. Re-run with --apply to delete ${rows.length} row(s).\n` +
          `Take a backup first if you have not: npm run backup\n`
      );
      return;
    }

    // One statement, scoped by slug — the same condition the preview used, so
    // there is no window in which the set could differ from what was shown.
    const res = await c.query(
      `DELETE FROM questionnaire_responses WHERE questionnaire_slug = $1`,
      [slug]
    );

    console.log(`\nDeleted ${res.rowCount} row(s). Not recoverable except from a backup.`);
    console.log(
      `\nNow remove the instrument from the registry and delete its file:\n` +
        `  src/lib/questionnaires/index.ts\n` +
        `  src/lib/questionnaires/${slug}.ts\n`
    );
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
