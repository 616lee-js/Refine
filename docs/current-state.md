# Current state

**Last updated:** 2026-11-11 · commit `4b956e9` · working tree clean
**Round in progress:** `build-package-2026-11.md` — Part 1 of 9 done, awaiting review

The sync point between the repo and planning conversations that cannot see the
code. Everything here is checked against the code on the day it is written.

**This is not the roadmap.** What to build and why lives in
[refine_v1_planning.md](refine_v1_planning.md); deferred capability in
[v2-roadmap.md](v2-roadmap.md); the reasoning behind decisions in
[refine_brainstorm_summary.md](refine_brainstorm_summary.md). This file only
says what exists right now.

---

## What is built and working

### Writing
- Write an entry, edit it, title it. Entry body and title encrypted.
- **Footholds** — writing prompts, collapsed by default. Some generic
  (`lib/journal/guidance.ts`), some drawn from the person's own past entries
  (`lib/journal/personal-guidance.ts`).
- Trash with restore; permanent purge after 30 days via a daily job.
- **No conversation loop.** There is no `/api/chat` and no `/api/classify`. The
  product is write-and-reflect, not chat. Claude never writes into an entry.

### Summaries (Cabinet 2)
- One summary per entry, **generated when the entry is marked done** (since
  2026-08-04). The daily 5am UTC job is a backstop: retries after a failure,
  re-summarises after an edit, and redoes the archive after a prompt change.
  (An earlier version of this file said the job wrote them. It does not.)
- The person can read and rewrite any summary. Their version wins everywhere —
  `authoritativeSummary()`.
- No length cap on a summary since 2026-10-12. There is a 20,000-character
  refusal limit on the *input*.

### Mirror
Three tabs: **Report**, **Memory**, **Trends**.
- **Report** — an AI-written account of the person's writing, broken out by the
  seven Personal Wellbeing Index areas, with an overall account leading. Editable
  per section; the person's edit wins. Runs on a cadence (default every 14 days),
  riding along on the daily summarise job. Also runnable by hand from `/admin/mirror`.
- **Memory** — hand-typed facts and threads. **Nothing generates these.** See
  Open items.
- **Trends** — charts of check-ins and framework scores. Lines draw at any number
  of readings; hover, tap or arrow-key a point for its date and value; a
  bar-per-area card for the PWI. Range picker: 1 month / year to date / all / custom.

### Frameworks and check-ins
- Daily check-in (sleep, mood, energy, a set of toggles).
- GAD-7, PHQ-9, Personal Wellbeing Index. SWLS was removed 2026-10-12.
- Partly answered responses are stored but never charted.

### Accounts and admin
- Email/password, invite-code gated. Codes and password-reset codes are managed
  both by CLI and from `/admin/access`.
- Login throttling: 8 failures, 15-minute lockout.
- Admin screens: access, Mirror runs and cadence, safety log, evaluations,
  feedback. All self-gated with `requireAdmin()`.

### Not built
Voice and dictation (flagged off — serverless has no disk for audio), guided
reflections, Cabinets 3–5.

---

## Schema

15 tables. Everything holding a person's words is encrypted at the field level
(AES-256-GCM); column names below say `encrypted_*` where that applies.

| Table | Key columns |
|---|---|
| `users` | `email_encrypted`, `email_hmac` (login lookup), `password_hash`, `display_name`, `preferences`, `time_zone` (from the device; every date is formatted in it) |
| `invite_codes` | `code`, `expires_at`, `used_at`, `used_by_user_id`, `revoked_at` |
| `password_reset_codes` | `user_id`, `code_hash` (bcrypt), `expires_at`, `used_at`, `revoked_at` |
| `login_attempts` | `email_hmac` (PK), `failed_count`, `locked_until` |
| `user_profiles` | one row per user, `encrypted_content` = JSON of tendencies/goals/background |
| `journal_entries` | `encrypted_body`, `encrypted_title`, `modality`, `completed_at`, `edited_at` (body/title changed after finishing), `tier_classification`, `deleted_at`, `purged_at`, `summary_attempts` |
| `journal_entry_summaries` | `encrypted_content` (AI), `encrypted_user_content` (their rewrite), `user_edited_at`, `generation_version` |
| `questionnaire_responses` | `questionnaire_slug`, `questionnaire_version`, `encrypted_answers`, `encrypted_scoring` (`{total, band, items}`), `completed_at`, `deleted_at` |
| `mirror_reviews` | `window_start`, `window_end`, `entries_read`, `encrypted_report`, `encrypted_user_report`, `encrypted_period_note`, `model_version` |
| `user_memory` | `kind`, `encrypted_content`, `source`, `is_active`, `last_confirmed_at` |
| `safety_log` | `journal_entry_id` / `questionnaire_response_id`, `tier`, `classifier_version`, `raw_signals`, `reviewed` |
| `content_access_log` | one row per decryption *event* with a count, never per record |
| `summary_evaluations` | per-criterion verdicts, `summariser_version`, optional encrypted snapshots |
| `report_evaluations` | same shape for reports, `prompt_version` |
| `feedback` | `type`, `body`, `page`, `status` — deliberately no `user_id` |
| `app_settings` | `key`/`value`. Holds the Mirror cadence and the snapshot flag |

**Enums**
- `entry_modality` — `text`, `voice`, `mixed`
- `memory_kind` — `fact`, `thread`, `preference`, `diagnostic_context`, `other`
- `memory_source` — `user_added`, `claude_inferred`, `entry_derived`
- `feedback_type` — `bug`, `request` · `feedback_status` — `new`, `completed`

Drizzle owns the schema. Migrations are applied by hand, never on deploy.

---

## Changes since the previous update — 2026-11-11 (Part 1 of the November round)

**Mirror schedule fixed** (`15dc4e6`). Two defects: the 14-day interval was never
enforced (the "last report" time came back as text and was compared to a date,
which is always false — one account got 11 reports in 30 days), and the daily
job had 60 seconds, so the second account's report was cut off every day with
nothing logged. The job now has 300 seconds, stops starting reports after 240,
orders longest-waiting first, and `/admin/mirror` shows each account's next due
date. **The first scheduled run under the fix has not happened yet** — expected
05:00 UTC on 2026-11-12: one report for the owner, none for the other account.

**Every date is now the person's own time zone** (`4b956e9`). The device
reports its zone on every page; the server formats every date in it; nothing
formats a date in the browser. Day boundaries follow — Home's "today", the
calendar, Trends ranges and buckets, the check-in guard, the archive filters.
An entry finished at 8:54 PM Pacific now reads 8:54 PM on that date instead
of 3:54 AM the next day. Zone is UTC until a person's first page view after
this shipped.

**Edited time on entries.** `edited_at` is written only when a finished entry's
body or title changes; the read-back header shows it beside the completed time.

**Schema:** migration `0014` — `users.time_zone`, `journal_entries.edited_at`.
Both nullable, nothing else touched, applied by hand after a backup.

**Docs:** summary timing corrected above (on submit, not the daily job).

---

## Decisions made during the build, recorded nowhere else

- **Plotting asserts nothing; interpreting does.** This is why a chart has no
  minimum but every sentence about a chart does. Same reasoning earlier allowed
  frameworks to be charted while their published severity ranges stay hidden
  until the wording is verified.
- **The carried-over report account is now the long-term memory.** Anything never
  written into a report or a period note is invisible to every later report.
  Recoverable — raw entries are immutable, so any past window can be re-reported —
  but it makes report quality load-bearing in a way it was not before.
- **12 period notes is a guess** (about 6 months at the 14-day cadence). Nothing
  validates it until reports have run under it.
- **Measurements are derived, so the Memory table is not a one-way door.** The
  owner's correction, 2026-10-12: if Memory turns out to be redundant it can be
  wiped and repurposed with no loss.
- **`[COPY]` markers are left visible on screen** rather than hidden, so unreviewed
  copy is obvious in use.
- **Quantities, never comparison words.** Now rule 10 in CLAUDE.md.
- **Time zone (2026-11-11):** recorded from the device into `users.time_zone`,
  formatted on the server, locale fixed to `en-US`, UTC as the fallback before
  the first page view. Rule: nothing in a client component formats a date; it
  receives text. `src/lib/time.ts` holds the arithmetic and is the one place
  that handles clock changes.

---

## Open items, known bugs, deferred work

Full register with severity and mitigation: [refine_known_limitations.md](refine_known_limitations.md).
Proposals awaiting a decision: [build-notes.md](build-notes.md).

**Blocking**
- **Phase 6 is blocked** on a focused Layer 2 system-prompt review.

**Live gaps**
- **Memory generates nothing.** Only the person writes to `user_memory`. The
  "proposed" state is unreachable, so the Keep control and the "waiting on you"
  callout are dead code. Proposal open in `build-notes.md`, which argues the
  honest home for it may be Trends rather than Memory.
- **The first-report path is untested.** Both accounts have reports, so nothing
  in the database exercises the branch where a report reads all history.
- **The report characterised figures in its own words** in the last run —
  "scored lowest on achieving in life", "mid-to-low on health". The prompt forbids
  it and so does rule 10. Not yet fixed; a prompt change needs the owner's pass.
- **The schedule fix is unobserved.** Fixed and deployed 2026-11-11; the first
  05:00 UTC run after it is the proof. Check `mirror_reviews` on 2026-11-12.
- **No instrument wording is verified** against a primary source, which is what
  withholds every severity-range key in Trends.

**Stale in CLAUDE.md, worth correcting**
- It says a read-only system-prompt page was built at `/settings/system-prompt`.
  **That page does not exist.**
- Its Phase 2 line and voice-paradigm note describe a conversation loop and
  per-utterance classification. Neither exists.

**Deferred by decision**
Guided reflections; voice and dictation; Cabinets 3–5; individual session
revocation; the test-persona work (dormant until after Phase 7).

---

## Placeholder copy awaiting review

**Every user-facing string in the app is still marked `[COPY]`** — around 600
lines across 43 files. These are drafts, not final wording, and the marker is
deliberately visible on screen.

Heaviest, if a review starts anywhere: the record rail and Memory panel (~45 lines
each), the summary and report assessment screens (~34 each), foothold guidance
(~30), onboarding and signup (~20 each), home (~19), Trends card copy (~18).

**New this session:** `[COPY] edited <time>` on the entry read-back header.

**Named items the owner has already flagged:**
- `[COPY] Life satisfaction by area` — the PWI's title, now shown on two Trends
  cards, which is why it reads awkwardly.
- `[COPY] Every 3 months` — the PWI's suggested rhythm.
- The daily check-in's "What happened" field and its toggle labels.
- Crisis-resource panel content, which is additionally pending clinician review
  (LIM-015).
