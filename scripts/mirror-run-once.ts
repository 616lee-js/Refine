import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";
import { encrypt, decrypt } from "../src/lib/crypto";
import { authoritativeSummary } from "../src/lib/summaries/read";
import { buildTrends, type DecryptedResponse } from "../src/lib/trends";

/**
 * Produce one Mirror report on demand, from the command line.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The report normally runs inside the nightly job, which needs CRON_SECRET, or
 * from the admin page, which needs ADMIN_USER_IDS. Neither is set in .env.local,
 * so neither can be triggered from a developer machine. Iterating on the
 * instructions needs a way to run one and read the result without waiting a
 * fortnight or deploying.
 *
 *   npm run mirror:once -- <user-id-prefix>
 *   npm run mirror:once -- <user-id-prefix> --dry
 *
 * ── It writes a real report ───────────────────────────────────────────────────
 * Without --dry the row lands in the database the same as any other, appears in
 * that person's Mirror, and is deleted from there. --dry prints the reply and
 * stores nothing.
 *
 * ── It deliberately ignores the schedule ──────────────────────────────────────
 * No fortnight check and no "has anything been written since last time" check.
 * Those are correct for the scheduled run and useless for testing a prompt.
 *
 * ── Where it duplicates, and where it must not drift ──────────────────────────
 * The prompt file, the resolver for corrected summaries, and the check-in
 * wording all come from the same modules the real run uses, so those cannot
 * disagree. What IS duplicated is the assembly of the message — the order of
 * sections and their headings. If src/lib/mirror/review.ts changes that order,
 * change it here too, or this stops previewing the thing it claims to preview.
 */

const PROMPT_PATH = join(
  process.cwd(),
  "src/lib/layer2/memory-extraction.md"
);
const MODEL = "claude-sonnet-5";
const MAX_SUMMARIES = 200;
const MAX_ENTRY_CHARS = 20_000;

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

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const prefix = args.find((a) => !a.startsWith("--"));
  if (!prefix) {
    console.error("Usage: npm run mirror:once -- <user-id-prefix> [--dry]");
    process.exit(1);
  }

  const prompt = readFileSync(PROMPT_PATH, "utf-8");
  const version = prompt.match(/^#\s*Version:\s*(.+)$/m)?.[1]?.trim() ?? "unversioned";
  if (version === "UNWRITTEN") {
    console.error(
      "The prompt has no real version line, so it is not ready to run.\n" +
        "See src/lib/layer2/memory-extraction.md"
    );
    process.exit(1);
  }

  const c = connect();
  await c.connect();

  try {
    const { rows: users } = await c.query<{ id: string }>(
      `SELECT id FROM users WHERE id LIKE $1`,
      [`${prefix}%`]
    );
    if (users.length !== 1) {
      throw new Error(
        `Expected exactly one account matching "${prefix}", found ${users.length}.`
      );
    }
    const userId = users[0].id;

    // Where the last report stopped, so "since" matches the scheduled run.
    const { rows: lastRows } = await c.query<{ window_end: Date }>(
      `SELECT window_end FROM mirror_reviews WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const since: Date | null = lastRows[0]?.window_end ?? null;

    const entryFilter = `user_id = $1 AND completed_at IS NOT NULL
       AND deleted_at IS NULL AND purged_at IS NULL`;

    const { rows: summaryRows } = await c.query(
      `SELECT j.completed_at, s.encrypted_content, s.encrypted_user_content,
              s.user_edited_at, s.generated_at, s.generation_version
         FROM journal_entry_summaries s
         JOIN journal_entries j ON j.id = s.journal_entry_id
        WHERE j.user_id = $1 AND j.completed_at IS NOT NULL
          AND j.deleted_at IS NULL AND j.purged_at IS NULL
        ORDER BY j.completed_at DESC LIMIT ${MAX_SUMMARIES}`,
      [userId]
    );

    const summaries: string[] = [];
    for (const r of summaryRows) {
      try {
        const s = authoritativeSummary({
          encryptedContent: r.encrypted_content,
          encryptedUserContent: r.encrypted_user_content,
          userEditedAt: r.user_edited_at,
          generatedAt: r.generated_at,
          generationVersion: r.generation_version,
        }).summary;
        const date = r.completed_at?.toISOString().slice(0, 10) ?? "undated";
        summaries.push(
          [
            `${date}: ${s.summary}`,
            s.topics.length ? `  categories: ${s.topics.join(", ")}` : null,
            s.people.length ? `  people: ${s.people.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        );
      } catch {
        /* unreadable summary is left out, as in the real run */
      }
    }

    const { rows: recentRows } = await c.query(
      `SELECT id, completed_at, encrypted_body FROM journal_entries
        WHERE ${entryFilter} ${since ? "AND completed_at > $2" : ""}
        ORDER BY completed_at ASC`,
      since ? [userId, since] : [userId]
    );

    const recent: { id: string; date: string; body: string }[] = [];
    for (const r of recentRows) {
      if (!r.encrypted_body) continue;
      try {
        recent.push({
          id: r.id,
          date: r.completed_at?.toISOString().slice(0, 10) ?? "undated",
          body: decrypt(r.encrypted_body).slice(0, MAX_ENTRY_CHARS),
        });
      } catch {
        /* unreadable entry is left out */
      }
    }

    const { rows: memoryRows } = await c.query(
      `SELECT kind, encrypted_content FROM user_memory
        WHERE user_id = $1 AND is_active = true AND last_confirmed_at IS NOT NULL`,
      [userId]
    );
    const memory: string[] = [];
    for (const r of memoryRows) {
      try {
        memory.push(`${r.kind}: ${decrypt(r.encrypted_content)}`);
      } catch {
        /* left out */
      }
    }

    const { rows: profileRows } = await c.query(
      `SELECT encrypted_content FROM user_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    let profile = "";
    if (profileRows[0]?.encrypted_content) {
      try {
        const p = JSON.parse(decrypt(profileRows[0].encrypted_content)) as Record<string, string>;
        profile = ["tendencies", "goals", "background"]
          .map((k) => (p[k]?.trim() ? `${k}: ${p[k].trim()}` : null))
          .filter(Boolean)
          .join("\n");
      } catch {
        /* left out */
      }
    }

    const { rows: qRows } = await c.query(
      `SELECT questionnaire_slug, completed_at, encrypted_answers, encrypted_scoring
         FROM questionnaire_responses
        WHERE user_id = $1 AND completed_at IS NOT NULL
          AND deleted_at IS NULL AND purged_at IS NULL`,
      [userId]
    );
    const responses: DecryptedResponse[] = [];
    for (const r of qRows) {
      if (!r.completed_at) continue;
      try {
        responses.push({
          slug: r.questionnaire_slug,
          completedAt: r.completed_at,
          answers: r.encrypted_answers
            ? JSON.parse(decrypt(r.encrypted_answers)).answers ?? {}
            : {},
          total: r.encrypted_scoring
            ? JSON.parse(decrypt(r.encrypted_scoring)).total ?? null
            : null,
        });
      } catch {
        /* left out */
      }
    }
    let checkins: string[] = [];
    if (responses.length > 0) {
      const t = buildTrends(responses);
      checkins = t.cards.map((card) => `${card.label} — ${card.meta}`);
      if (t.plainly) checkins.push(t.plainly);
    }

    const { rows: priorRows } = await c.query(
      `SELECT encrypted_report, encrypted_user_report, created_at
         FROM mirror_reviews WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 6`,
      [userId]
    );
    const prior: string[] = [];
    for (const r of priorRows) {
      try {
        const text = decrypt(r.encrypted_user_report ?? r.encrypted_report);
        prior.push(`${r.created_at.toISOString().slice(0, 10)}: ${text}`);
      } catch {
        /* left out */
      }
    }

    if (recent.length === 0) {
      console.log(
        "Nothing written since the last report. The scheduled run would do nothing here."
      );
      console.log("Running anyway, because this is a preview.\n");
    }

    // Same order and headings as src/lib/mirror/review.ts. See the note above.
    const message = [
      "## What they have told Refine about themselves",
      profile || "(nothing)",
      "",
      "## Confirmed in their Mirror",
      memory.join("\n") || "(nothing)",
      "",
      "## Summaries of everything written so far",
      summaries.join("\n\n") || "(none)",
      "",
      "## Entries written since the last report, in full",
      recent.map((r) => `### ${r.date}\n${r.body}`).join("\n\n") || "(none)",
      "",
      "## Check-in figures — stated wording, do not restate in your own words",
      checkins.join("\n") || "(none)",
      "",
      "## What previous reports said",
      prior.join("\n\n") || "(none)",
    ].join("\n");

    console.log("─".repeat(70));
    console.log(`account        ${userId}`);
    console.log(`prompt         ${version}`);
    console.log(`summaries      ${summaries.length}`);
    console.log(`entries in full ${recent.length}`);
    console.log(`memory items   ${memory.length}`);
    console.log(`check-in lines ${checkins.length}`);
    console.log(`prior reports  ${prior.length}`);
    console.log(`profile        ${profile ? "present" : "empty"}`);
    console.log(`input size     ${message.length} characters`);
    console.log("─".repeat(70));

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set in .env.local");

    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: prompt,
      messages: [{ role: "user", content: message }],
    });

    const raw = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = JSON.parse(
      raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")
    ) as { report: string; periodNote: string };

    const reportText = checkins.length
      ? `${parsed.report}\n\n${checkins.join("\n")}`
      : parsed.report;

    console.log("\n=== REPORT ===\n");
    console.log(reportText);
    console.log("\n=== PERIOD NOTE ===\n");
    console.log(parsed.periodNote);
    console.log(
      `\n(report ${parsed.report.split(/\s+/).length} words, note ${parsed.periodNote.split(/\s+/).length} words)`
    );

    if (dry) {
      console.log("\n--dry: nothing stored.");
      return;
    }

    const id = randomUUID();
    await c.query(
      `INSERT INTO mirror_reviews
         (id, user_id, window_start, window_end, entries_read,
          encrypted_report, encrypted_period_note, model_version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
      [
        id,
        userId,
        since ?? new Date(0),
        new Date(),
        recent.length,
        encrypt(reportText),
        encrypt(parsed.periodNote),
        version.replace(/\s+[—–-]\s+/, "@"),
      ]
    );

    console.log(`\nStored. Visible in Mirror, and deletable from there.`);
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
