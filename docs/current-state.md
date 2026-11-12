# Current state

**Last updated:** 2026-11-12 · pushed `7ecb22d` · **`7d263da` (summariser v4) committed locally, not pushed — awaiting the owner's approval of sample output**
**Round in progress:** `build-package-2026-11.md` — Parts 1, 2 and 6 built; Part 6 awaiting two decisions (below)

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
- **Footholds** — writing prompts, **always closed when an entry opens**; opening
  them lasts for that entry only and nothing is saved. Some generic
  (`lib/journal/guidance.ts`), some drawn from the person's own past entries
  (`lib/journal/personal-guidance.ts`). The panel never lengthens the page.
- Enter starts a new paragraph (a blank line); Shift+Enter is a single line
  break. Writing area is 682px wide.
- **Categories are the person's own** (since 2026-11-12). Add, rename, remove
  and attach them from the entry header, the editor, or the entry's card in
  Reflections; filter Reflections by one. Refine never suggests or assigns a
  category. Names are encrypted.
- **Sensitive flag** on the entry header. A flagged entry stays readable and
  editable, is still classified for safety, and is kept out of Mirror reports
  and the personal footholds (Trends and Threads apply it when built). Flagging
  an entry a report already read makes the next report rebuild without the
  carried-over account, once.
- Trash with restore; permanent purge after 30 days via a daily job.
- **No conversation loop.** There is no `/api/chat` and no `/api/classify`. The
  product is write-and-reflect, not chat. Claude never writes into an entry.

### Summaries (Cabinet 2)
- One summary per entry, **generated when the entry is marked done** (since
  2026-08-04). The daily job (08:00 UTC) is a backstop: retries after a failure
  and re-summarises after an edit. **A prompt change never regenerates existing
  summaries** (rule removed 2026-11-12); it applies to entries submitted or
  edited after it. (An earlier version of this file said the job wrote them. It
  does not.)
- The person can read and rewrite any summary. Their version wins everywhere —
  `authoritativeSummary()`.
- A summary's `topics` are the summariser's phrases for what the entry is
  about — since v4 (2026-11-12), two to five phrases in the writer's own words.
  Summaries written before that still carry the old nine labels as topics and
  are left as they are.
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
- Daily check-in (sleep, mood, energy, a set of toggles). Version
  `v3-2026-11-11`: the screens toggle now reads "Screen time within one hour
  before sleep" (tapping it means screens were used). Same key as before.
- GAD-7, PHQ-9, Personal Wellbeing Index. SWLS was removed 2026-10-12.
- A completed framework shows its score out of the total possible ("12 / 21")
  on the record and on its card in Reflections. Only when every item is
  answered. Severity ranges stay hidden.
- Partly answered responses are stored but never charted and never scored on
  screen.

### Accounts and admin
- Email/password, invite-code gated. Codes and password-reset codes are managed
  both by CLI and from `/admin/access`.
- Login throttling: 8 failures, 15-minute lockout.
- Admin screens: access, Mirror runs and schedule, safety log, evaluations,
  feedback. Reached from one **"Admin settings"** item in the top nav, which
  opens a menu; shown to admins only. All self-gated with `requireAdmin()`.

### Not built
Voice and dictation (flagged off — serverless has no disk for audio), guided
reflections, Cabinets 3–5.

---

## Schema

17 tables. Everything holding a person's words is encrypted at the field level
(AES-256-GCM); column names below say `encrypted_*` where that applies.

| Table | Key columns |
|---|---|
| `users` | `email_encrypted`, `email_hmac` (login lookup), `password_hash`, `display_name`, `preferences`, `time_zone` (from the device; every date is formatted in it) |
| `invite_codes` | `code`, `expires_at`, `used_at`, `used_by_user_id`, `revoked_at` |
| `password_reset_codes` | `user_id`, `code_hash` (bcrypt), `expires_at`, `used_at`, `revoked_at` |
| `login_attempts` | `email_hmac` (PK), `failed_count`, `locked_until` |
| `user_profiles` | one row per user, `encrypted_content` = JSON of tendencies/goals/background |
| `journal_entries` | `encrypted_body`, `encrypted_title`, `modality`, `completed_at`, `edited_at` (body/title changed after finishing), `sensitive_at` (flagged by the person; null = not), `tier_classification`, `deleted_at`, `purged_at`, `summary_attempts` |
| `journal_entry_summaries` | `encrypted_content` (AI), `encrypted_user_content` (their rewrite), `user_edited_at`, `generation_version` |
| `entry_categories` | the person's own categories: `user_id`, `encrypted_name` |
| `journal_entry_categories` | which entries carry which categories; primary key (`journal_entry_id`, `category_id`), both cascade |
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

## Changes since the previous update — 2026-11-11 to 11-12 (November round, Parts 1, 2, 6)

### Part 6 — categories, sensitive flag, summariser v4 (2026-11-12)

**Pushed (`7ecb22d`):**
- **Categories belong to the person.** Two new tables. One control on the entry
  header, the editor and the Reflections card: pick from your list, create by
  typing, rename or delete under "Manage". Reflections filters by category as a
  database join; the list no longer decrypts summaries at all.
- **Sensitive flag** on the entry header, with what it does stated under the
  button. Excluded from the report's summaries, window entries and counts, and
  from personal footholds. Flag after a report read it → next run withholds the
  carried-over account once.
- Report input: summariser `topics` labelled "topics", the person's categories
  on a separate "their categories" line.
- Two scripts: `npm run categories:backfill` (dry-run; `--apply` writes) would
  turn the nine old labels into each person's starting categories — **decided
  not to run**; lists start empty. `npm run summarise:preview` runs the
  working-tree summariser over real entries, stores nothing.
- Migration `0015`: two tables, one nullable column. Applied after a backup.

**Summariser v4** — topics in the writer's own words, approved from sample
output on three real entries. Shipped with one correction the owner called out:
the queue no longer treats a summary from an older prompt as due, so **nothing
already summarised is regenerated** — v4 applies to entries submitted or
edited from now on. That re-summarise-everything rule had been in the queue
since Phase 6; it is gone.

### Part 2 — six small fixes (`5ee6b80`, 2026-11-12)

- **Reflections on a phone:** no empty band above the folded list; choosing a
  record folds the list so the record has the screen.
- **Check-in toggle:** "Screens after 11" → "Screen time within one hour before
  sleep" (approved, no marker). Same key, version bumped. Trends' habit grid
  still draws days answered under the old wording and says so in one line under
  the grid, naming the date and the old text.
- **Footholds:** closed on every entry, always. The saved preference that was
  reopening them is no longer read or written.
- **Framework scores:** "12 / 21" on the record and the Reflections card;
  nothing for a partial response.
- **Admin settings** menu replaces the row of five links in the nav.
- **Writing area** 682px (from 620). **Enter starts a paragraph** — a blank
  line, so the gap is real text and shows the same everywhere; Shift+Enter is
  a single line break.

### Part 1 — time, dates, schedule (2026-11-11)

**Mirror schedule fixed** (`15dc4e6`). Two defects: the 14-day interval was never
enforced (the "last report" time came back as text and was compared to a date,
which is always false — one account got 11 reports in 30 days), and the daily
job had 60 seconds, so the second account's report was cut off every day with
nothing logged. The job now has 300 seconds, stops starting reports after 240,
orders longest-waiting first, and `/admin/mirror` shows each account's next due
date.

**Reports now run on a fixed schedule** (owner's instruction, same day): from
**Sunday 2026-11-15 at midnight Pacific**, then every 14 days on that anchor —
Sundays at midnight, kept at midnight across clock changes. Not "14 days since
the last report": running one by hand does not move the schedule. A missed run
is caught up the next day. Anchor and zone are settings, editable on
`/admin/mirror`; the interval is the existing 7/14/30 choice. The daily job
moved from 05:00 UTC to **08:00 UTC** (midnight Pacific in winter, 1 AM in
summer; the hosting plan runs it sometime within that hour). Still skipped for
anyone who has written nothing since their last report.

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
- **A wording change that changes what an answer means keeps its key, bumps
  the version, and is listed in `CHECKIN_REWORDINGS`** (`daily-checkin.ts`)
  with the date and the old text, so a chart mixing old and new answers can
  say so. First use: the screens toggle, 2026-11-11.
- **Reports run on a fixed anchor** (day + zone in `app_settings`), not "N days
  since the last one". Manual runs never move the schedule.
- **Categories are rows, not words inside a summary** (2026-11-12). That is
  what lets the archive filter by category as a join and stop decrypting
  summaries for its list. The summariser's `topics` are a description of an
  entry; the person's categories are a filing system. Separate things, both
  reach the report, on separate lines.
- **A flagged entry leaves the report chain by withholding one carried-over
  account**, not by asking the model to forget. The window's start still
  counts every entry: when the record began is a fact, not something the
  report reads.
- **The category filter stays a select**, not a row of labels: it absorbs any
  number of categories, which was the package's requirement.

---

## Open items, known bugs, deferred work

Full register with severity and mitigation: [refine_known_limitations.md](refine_known_limitations.md).
Proposals awaiting a decision: [build-notes.md](build-notes.md).

**Blocking**
- **Phase 6 is blocked** on a focused Layer 2 system-prompt review.

**Live gaps**
- **Category lists are empty** on both accounts until the person creates some.
  Decided 2026-11-12: the old labels are not carried over.
- **The sensitive flag is not yet honoured by Trends or Threads** — neither
  reads entries today. Each applies it when it is built (Parts 4 and 3).
- **Memory generates nothing.** Only the person writes to `user_memory`. The
  "proposed" state is unreachable, so the Keep control and the "waiting on you"
  callout are dead code. Proposal open in `build-notes.md`, which argues the
  honest home for it may be Trends rather than Memory.
- **The first-report path is untested.** Both accounts have reports, so nothing
  in the database exercises the branch where a report reads all history.
- **The report characterised figures in its own words** in the last run —
  "scored lowest on achieving in life", "mid-to-low on health". The prompt forbids
  it and so does rule 10. Not yet fixed; a prompt change needs the owner's pass.
- **The schedule is unobserved.** First scheduled run is Sunday 2026-11-15,
  midnight Pacific (08:00 UTC). Check `mirror_reviews` that morning: one
  report per account that has written since its last report, none otherwise.
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

**New this round:** `[COPY] edited <time>` on the entry read-back header;
`[COPY] Score` above a framework's "12 / 21"; `[COPY] Before <date> this asked
"Screens after 11".` under the habit grid; the whole category control
(`+ Category`, `Find or create…`, `Create "x"`, `Manage`, `Rename`, `Delete`,
the delete confirmation); the sensitive button and its note (`Mark sensitive`,
`Sensitive · unmark`, "A sensitive entry stays yours to read and edit, and is
kept out of Mirror reports, Threads and Trends."); `[COPY] Sensitive` on a
card; `[COPY] Topics` replacing "Categories" in the summary editor.

**Named items the owner has already flagged:**
- `[COPY] Life satisfaction by area` — the PWI's title, now shown on two Trends
  cards, which is why it reads awkwardly.
- `[COPY] Every 3 months` — the PWI's suggested rhythm.
- The daily check-in's "What happened" field and its toggle labels — except
  "Screen time within one hour before sleep", approved 2026-11-11.
- Crisis-resource panel content, which is additionally pending clinician review
  (LIM-015).
