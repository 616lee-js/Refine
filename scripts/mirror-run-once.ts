import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_ROOT_CA_2021 } from "../src/lib/db/supabase-ca";
import { encrypt, decrypt } from "../src/lib/crypto";
import { authoritativeSummary } from "../src/lib/summaries/read";
import { buildTrends, type DecryptedResponse } from "../src/lib/trends";
import {
  accountText,
  parseReport,
  trendsToLines,
  DEFAULT_INTERVAL_DAYS,
  MAX_ENTRY_CHARS,
  MAX_SUMMARIES,
  PRIOR_FULL_REPORTS,
  PRIOR_PERIOD_NOTES,
  SUMMARY_PERIODS,
} from "../src/lib/mirror/review";
import { authoritativeReport, periodNote } from "../src/lib/mirror/read";
import { domainLabel, domainPromptBlock } from "../src/lib/mirror/domains";
import {
  reportToText,
  serialiseReport,
  type StructuredReport,
} from "../src/lib/mirror/read";

/**
 * Produce one Mirror report on demand, from the command line.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The report normally runs inside the nightly job, which needs CRON_SECRET, or
 * from the admin page, which needs ADMIN_USER_IDS. Neither is set in .env.local,
 * so neither can be triggered from a developer machine. Iterating on the
 * instructions needs a way to run one and read the result without waiting
 * 14 days or deploying.
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
 * No interval check and no "has anything been written since last time" check.
 * Those are correct for the scheduled run and useless for testing a prompt.
 *
 * ── Where it duplicates, and where it must not drift ──────────────────────────
 * The prompt file, the area list and its interpolation, the reply parser, the
 * resolver for corrected summaries, and the check-in wording all come from the
 * same modules the real run uses, so none of those can disagree.
 *
 * What IS still duplicated is the assembly of the message — the order of the
 * blocks and their headings. If src/lib/mirror/review.ts changes that order,
 * change it here too, or this stops previewing the thing it claims to preview.
 *
 * The reply used to be cast to a shape and trusted here. It now goes through the
 * real `parseReport`, because with sections a local cast would keep an invented
 * area name that the real run discards — a preview that lies about what it
 * previews is worse than no preview.
 */

const PROMPT_PATH = join(
  process.cwd(),
  "src/lib/layer2/memory-extraction.md"
);
const MODEL = "claude-sonnet-5";
// MAX_SUMMARIES, MAX_ENTRY_CHARS and the three reach constants are imported from
// review.ts rather than redeclared. They were copies here until 2026-10-12, which
// is exactly the drift this file's header warns about.

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

    // When the record begins, for a first report's window start. Mirrors
    // gather() in src/lib/mirror/review.ts.
    const { rows: earliestRows } = await c.query<{ completed_at: Date }>(
      `SELECT completed_at FROM journal_entries
        WHERE ${entryFilter} ORDER BY completed_at ASC LIMIT 1`,
      [userId]
    );
    const windowEnd = new Date();
    const windowStart: Date =
      since ?? earliestRows[0]?.completed_at ?? windowEnd;

    /*
     * The history first, because how far the summaries reach depends on whether
     * there is any. Mirrors the order in reviewUser().
     */
    const { rows: priorRows } = await c.query(
      `SELECT encrypted_report, encrypted_user_report, user_edited_at,
              encrypted_period_note, created_at
         FROM mirror_reviews WHERE user_id = $1
        ORDER BY created_at DESC LIMIT ${PRIOR_FULL_REPORTS + PRIOR_PERIOD_NOTES}`,
      [userId]
    );

    let account: { date: string; text: string } | null = null;
    const notes: string[] = [];
    for (const [i, r] of priorRows.entries()) {
      // Through the same resolvers as the real run. This used to decrypt the
      // column and interpolate it, which put raw JSON in the preview's prompt
      // once reports became structured.
      const row = {
        encryptedReport: r.encrypted_report as string,
        encryptedUserReport: r.encrypted_user_report as string | null,
        userEditedAt: r.user_edited_at as Date | null,
        encryptedPeriodNote: r.encrypted_period_note as string,
      };
      const at = (r.created_at as Date).toISOString().slice(0, 10);
      try {
        if (i < PRIOR_FULL_REPORTS) {
          account = { date: at, text: accountText(authoritativeReport(row).report) };
        } else {
          notes.push(`${at}: ${periodNote(row)}`);
        }
      } catch {
        /* left out */
      }
    }
    notes.reverse();

    // The cadence as the real run reads it, so the reach is the same. Falls back
    // to the default when nobody has set it.
    const { rows: settingRows } = await c.query<{ value: unknown }>(
      `SELECT value FROM app_settings WHERE key = 'mirror_review_interval_days'`
    );
    const intervalDays =
      typeof settingRows[0]?.value === "number" &&
      Number.isFinite(settingRows[0].value)
        ? (settingRows[0].value as number)
        : DEFAULT_INTERVAL_DAYS;

    const summaryDays = SUMMARY_PERIODS * intervalDays;
    const { rows: summaryRows } = await c.query(
      `SELECT j.completed_at, s.encrypted_content, s.encrypted_user_content,
              s.user_edited_at, s.generated_at, s.generation_version
         FROM journal_entry_summaries s
         JOIN journal_entries j ON j.id = s.journal_entry_id
        WHERE j.user_id = $1 AND j.completed_at IS NOT NULL
          AND j.deleted_at IS NULL AND j.purged_at IS NULL
          ${account ? `AND j.completed_at > now() - interval '${summaryDays} days'` : ""}
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
    // The formatting, and the [COPY] strip, come from review.ts rather than
    // being repeated here — a figure phrased differently in a test run than in a
    // scheduled report makes the test run useless for judging the wording.
    const checkins: string[] =
      responses.length > 0 ? [...trendsToLines(buildTrends(responses))] : [];

    if (recent.length === 0) {
      console.log(
        "Nothing written since the last report. The scheduled run would do nothing here."
      );
      console.log("Running anyway, because this is a preview.\n");
    }

    // Same order and headings as src/lib/mirror/review.ts. See the note above.
    const day = (at: Date) => at.toISOString().slice(0, 10);
    const message = [
      "## This report's window — given figures, do not recount",
      `Window begins: ${day(windowStart)}`,
      `Window ends: ${day(windowEnd)}`,
      `Entries written in this window: ${recent.length}`,
      "Use these exact figures when referring to how much this report covers.",
      "",
      "## What they have told Refine about themselves",
      profile || "(nothing)",
      "",
      "## Confirmed in their Mirror",
      memory.join("\n") || "(nothing)",
      "",
      account
        ? `## Summaries of their entries — the last ${summaryDays} days only, not their whole history`
        : "## Summaries of everything written so far — ALL of their history, not this window",
      summaries.join("\n\n") || "(none)",
      "",
      "## Entries written in this window, in full",
      recent.map((r) => `### ${r.date}\n${r.body}`).join("\n\n") || "(none)",
      "",
      "## Check-in figures — ALL of their history. Stated wording, do not restate in your own words",
      checkins.join("\n") || "(none)",
      "",
      "## The current account, carried over from the most recent report — everything older than the summaries above lives here",
      account ? `${account.date}\n${account.text}` : "(none — this is their first report)",
      "",
      "## What each earlier period noted at the time — oldest first",
      notes.join("\n") || "(none)",
    ].join("\n");

    console.log("─".repeat(70));
    console.log(`account        ${userId}`);
    console.log(`prompt         ${version}`);
    console.log(`window         ${day(windowStart)} to ${day(windowEnd)}`);
    console.log(`summaries      ${summaries.length}`);
    console.log(`entries in full ${recent.length}`);
    console.log(`memory items   ${memory.length}`);
    console.log(`check-in lines ${checkins.length}`);
    console.log(`account        ${account ? `carried over from ${account.date}` : "none — first report"}`);
    console.log(`period notes   ${notes.length}`);
    console.log(`profile        ${profile ? "present" : "empty"}`);
    console.log(`input size     ${message.length} characters`);
    console.log("─".repeat(70));

    /*
     * What each part of the message costs, and whether it grows.
     *
     * The question this answers: does a report get more expensive the longer
     * someone keeps a journal? Only one part of the message can, and this says
     * by how much. --measure stops here, so asking costs nothing.
     */
    const pct = (n: number) => `${Math.round((n / message.length) * 100)}%`;
    const blocks: [string, number, string][] = [
      ["profile", (profile || "(nothing)").length, "fixed — 3 fields"],
      [
        "Mirror items",
        memory.join("\n").length,
        `grows with Mirror — ${memory.length} now, no cap`,
      ],
      [
        "summaries",
        summaries.join("\n\n").length,
        account
          ? `${summaries.length} entries in the last ${summaryDays} days — bounded by writing rate`
          : `ALL history, ${summaries.length} now, capped at ${MAX_SUMMARIES} — first report only`,
      ],
      [
        "entries in full",
        recent.map((r) => `### ${r.date}\n${r.body}`).join("\n\n").length,
        "this window only — bounded by the interval",
      ],
      [
        "check-in figures",
        checkins.join("\n").length,
        "grows with instruments, not with responses",
      ],
      [
        "carried-over account",
        account ? `${account.date}\n${account.text}`.length : 0,
        `the whole record, compressed — ${PRIOR_FULL_REPORTS} report, flat forever`,
      ],
      [
        "period notes",
        notes.join("\n").length,
        `${notes.length} of ${PRIOR_PERIOD_NOTES} max — about ${Math.round((PRIOR_PERIOD_NOTES * intervalDays) / 30)} months`,
      ],
    ];
    for (const [name, size, note] of blocks) {
      console.log(
        `  ${name.padEnd(17)}${String(size).padStart(7)} chars  ${pct(size).padStart(4)}  ${note}`
      );
    }
    console.log("─".repeat(70));

    if (args.includes("--measure")) {
      console.log("\n--measure: no call made, nothing spent.");
      return;
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set in .env.local");

    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: MODEL,
      // Matches review.ts, and must: this number is the budget for the model's
      // reasoning AND the report, and 4000 was consumed entirely by reasoning on
      // a full account. See the note there.
      max_tokens: 16000,
      // The area list is interpolated, exactly as the real run does it.
      system: prompt.replace("{{DOMAINS}}", domainPromptBlock()),
      messages: [{ role: "user", content: message }],
    });

    const raw = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");

    /*
     * What came back, before anything tries to read it.
     *
     * The parser throws "Report reply was not JSON" and says nothing about why,
     * which is useless for the two causes that actually happen: a reply cut off
     * at the token limit, and a reply with prose in front of the JSON. Both are
     * visible here and nowhere else — the scheduled run records the message and
     * discards the reply.
     */
    console.log(`stop reason    ${response.stop_reason}`);
    console.log(
      `reply          ${response.usage.output_tokens} output tokens, ${raw.length} characters`
    );
    console.log("─".repeat(70));
    if (response.stop_reason === "max_tokens") {
      console.log(
        "\nCUT OFF AT THE TOKEN LIMIT. The reply is incomplete, so it cannot parse.\n"
      );
    }
    if (process.env.MIRROR_SHOW_RAW === "1" || response.stop_reason === "max_tokens") {
      console.log("=== RAW REPLY ===\n");
      console.log(raw);
      console.log("\n=== END RAW ===\n");
    }

    /*
     * Through the real parser, not a local cast.
     *
     * This used to cast the reply to a shape and trust it. With sections that
     * would silently keep an invented area name, so the preview would show a
     * section the real run discards — a preview that lies about what it previews
     * is worse than no preview.
     */
    let parsed;
    try {
      parsed = parseReport(raw);
    } catch (err) {
      // The reply is the only evidence of what went wrong, and it is gone the
      // moment this process exits.
      console.log("=== REPLY DID NOT PARSE — RAW BELOW ===\n");
      console.log(raw);
      console.log("\n=== END RAW ===\n");
      throw err;
    }

    const stored: StructuredReport = {
      overall: parsed.overall,
      sections: parsed.sections,
      figures: checkins,
    };

    console.log("\n=== OVERALL ===\n");
    console.log(parsed.overall);
    for (const s of parsed.sections) {
      console.log(`\n=== ${(domainLabel(s.domain) ?? s.domain).toUpperCase()} ===\n`);
      console.log(s.text);
    }
    if (checkins.length) {
      console.log("\n=== FIGURES (verbatim from Trends) ===\n");
      console.log(checkins.join("\n"));
    }
    console.log("\n=== PERIOD NOTE ===\n");
    console.log(parsed.periodNote);
    console.log(
      `\n(overall ${parsed.overall.split(/\s+/).length} words, ` +
        `${parsed.sections.length} section(s), ` +
        `${reportToText(stored).split(/\s+/).length} words total, ` +
        `note ${parsed.periodNote.split(/\s+/).length} words)`
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
        windowStart,
        windowEnd,
        recent.length,
        encrypt(serialiseReport(stored)),
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
