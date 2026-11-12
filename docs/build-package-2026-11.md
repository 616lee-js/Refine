# Refine build package — November 2026 round

**Issued:** 2026-11-11 by the owner's planning chat. Revised the same day after the owner's corrections.
**Written against:** `docs/current-state.md`, last updated 2026-11-11, commit `02a0ec3`.

---

## How to read this

- The planning chat cannot see the code. Requirements below come from the owner. Statements about what exists come from `docs/current-state.md`. Where the two disagree, this file says so and asks you to check.
- "Owner" lines are decisions. Do not reopen them. If one cannot be built as written, say why and stop.
- "Propose" means the owner wants your recommendation before you build.
- "Check" lines are how the owner will judge the item done.

## How to work through it

1. **Verify.** Answer Part 0. List every place this package disagrees with the code or with CLAUDE.md. No building.
2. **Plan.** For each part: what changes, schema changes with the SQL, every prompt change in full, and the decisions you need from the owner. Wait for approval.
3. **Build one part at a time.** Stop after each part for the owner's review.

Suggested order is the order of the parts. The owner may reorder.

## Rules for the whole round

1. **Additive schema only.** Real user data exists. Show migration SQL before anything is applied. Run `npm run db:dump` before any migration or backfill.
2. **No invented final copy.** Every new user-facing string carries the visible `[COPY]` marker, as the repo already does. Strings this file marks "approved by owner" go in without the marker.
3. **Stored keys never change once data exists.** Change the label, bump the version.
4. **Every prompt change is approved first.** Summariser, classifier and report prompts are shown to the owner in full, with sample output, before they run. Bump the version.
5. **Quantities, never comparison words** (CLAUDE.md rule 10). This holds everywhere except the report's third layer, which is the one stated exception (Part 3).
6. **Plotting asserts nothing, interpreting does.** Any new sentence about data needs a floor. Propose it.
7. **Sensitive entries stay out.** An entry flagged sensitive (item 13) is excluded from every surface listed there. Every part that reads entry content honors it.
8. **Non-clinical positioning holds.** No diagnostic labels anywhere.
9. **Update `docs/current-state.md`** at the end of every session.

---

## Part 0 — Check these first and report back

Answer each briefly. Do not build.

1. **Footholds default.** Footholds used to open by default. The owner confirms they must start collapsed. Confirm that is how every new entry behaves, including when a user left them open last time.
2. **Summary timing.** The owner confirms summaries have been generated on submit since the last round. Current-state says a daily job at 5am UTC writes them. Confirm the code, then correct current-state and any other doc that says otherwise. If the code does not generate on submit, stop and say so.
3. **Report inputs.** List exactly what a Mirror Report reads today. Does it read the Profile (`user_profiles`) or Memory (`user_memory`) at all?
4. **Report model.** Which model writes the report, and with what token budget?
5. **Entry categories.** Where are the preset PWI-style categories on entries stored (on the summary, on the entry, elsewhere)? Who assigns them? What depends on them?
6. **Summary topics.** Does the summariser still record topics in the writer's own words, or did the last round's category change replace them?
7. **Safety log.** What does each row show today: entry text, a category, a summary, or none of these? Does a legend of the tiers exist? Do rows record their source (entry, edit, framework)?
8. **Entry time stamps.** Which exist (`created_at`, `updated_at`, `completed_at`)? What bumps `updated_at` besides a user edit?
9. **Check-ins.** Can more than one daily check-in exist for the same day today? How is "today" decided?
10. **Frameworks.** Does each framework definition already carry a suggested rhythm (the PWI shows "[COPY] Every 3 months")? What total and maximum does scoring store for each framework, including the PWI?
11. **Mirror schedule.** Why did the report not run on October 26 (item 10)? Give the root cause.
12. **Report assessment.** Do the report assessment criteria (`report_evaluations`) depend on the seven-area structure?
13. **Time zones.** How are dates and times formatted today? Does the server know any user's time zone?
14. **Profile and onboarding.** What do the Profile page and onboarding collect, show and let the user edit today?
15. **Memory controls.** What were the unused "proposed" state, the Keep control and the "waiting on you" callout built to do? Can they serve threads that Refine records (Part 3)?

---

## Part 1 — Time, dates and the report schedule

Items 4, 9, 14 and Part 4 all depend on 1A. Do it first.

### 1A. One time-zone approach

- **Problem (owner):** an entry submitted Monday 10/12 at 8:54pm shows in history as completed Tuesday 10/13 at 3:54am. The 7-hour gap is UTC being shown.
- **From current-state:** formatting dates in the browser is a known hazard. It broke a page before, and `trash-list` and `mirror/report-panel` still do it.
- **Requirement:** every date and time a user sees is in their own local time, with no mismatch between server and browser.
- Choose one approach and use it everywhere. Tell the owner what you chose. No owner decision is needed. One option: record the user's time zone from their device, keep it current, and format on the server in that zone.
- **Scope:** every place that derives a day or a time. That includes entry history and read-back, check-in "today", Home, Trends day buckets, Reflections grouping, the Mirror report window and header, trash, and the admin lists. Fix the two screens current-state names.

### Item 4. Entry completed and edited times

- Show the actual local time the user completed the entry.
- If the entry was edited after completion, track and show both the completed time and the edited time.
- If `updated_at` is bumped by anything other than a user edit, add a separate edited time. Additive.
- **Check:** an entry completed at 8:54pm local shows 8:54pm on that local date everywhere it appears.

### Item 10. Mirror report did not run on schedule

- **Report (owner):** the cadence in Admin settings is 14 days. A report should have run on October 26 and did not. A manual run for all users from `/admin/mirror` worked.
- **From current-state:** the report rides along on the daily summarise job.
- Find the root cause and report it before fixing. Leads to check:
  - Whether the job reaches the report step on days with summaries to write and on days with none.
  - The function time limit against a 16,000-token report.
  - The job's logs for October 26 and 27.
  - How the next due date is computed after a manual run.
  - UTC day boundaries.
- Fix it. A missed run is caught up at the next opportunity, not skipped.
- `/admin/mirror` shows the last run and the next due date, so a missed run is visible.
- **Check:** with the cadence at 14 days, a report runs on day 14 without anyone touching it, and a deliberately missed day is caught up the next day.

---

## Part 2 — Small fixes

Each is independent.

### Item 1. Reflections on mobile

- **Problem:** in mobile view a large empty margin takes up most of the screen. The filters and history component comes first. The view window is far down the page, after the full history.
- On mobile, the filter/search and history component becomes a small collapsible section at the top. The view sits directly below it. Remove the oversized margin.
- Selecting an item from history (Entry, Check-in, Framework) immediately collapses that section so the view takes the space.
- Desktop and tablet stay as they are.

### Item 2. Daily check-in toggle wording

- **Problem:** with "screens after 11" it is unclear whether selecting it means the user did or did not have screen time.
- Selecting it means the user did have screen time within one hour before sleeping. No fixed 11pm.
- **Label, approved by owner, no marker:** "Screen time within one hour before sleep"
- Keep the stored key. The definition changed, so bump the check-in version.
- **Propose** how the habit grid in Trends treats answers recorded under the old definition.

### Item 3. Footholds when creating an entry

- Footholds start collapsed on every new entry. **Owner decision.** They used to open by default. No saved state reopens them.
- The panel never lengthens the page. When its content is long, the panel scrolls inside itself.

### Item 5. Framework scores

- A completed framework shows its score out of the total possible, for example 12 / 21. It shows on completion and when viewing a completed response.
- The same score shows on the framework's card in Reflections.
- No running tally while answering. Scored frameworks only, not the daily check-in. A partly answered response shows no score.
- Severity ranges stay hidden, as today.
- Scores on cards mean decrypting in a list. Follow the existing `content_access_log` rule: one row per event with a count.

### Item 6. Admin menu

- One top-level nav item named "Admin settings". **Wording approved by owner.**
- The existing admin screens (access, Mirror, safety log, evaluations, feedback) appear in a submenu when the admin selects or hovers over it. On touch, tap opens it.
- Admins only, as now.

### Item 7. Wider entry window

- Widen the writing area by 10% when creating an entry. The owner will give visual feedback after seeing it.

### Item 8. Paragraph spacing

- Pressing Enter or Return to start a new line adds extra space below, so paragraphs are visibly separated. This shows while writing and when reading the entry back.
- A plain text box cannot do this alone. **Propose** the approach before building.
- It must not bring back cursor or scroll jumping. The safety classification that splits on paragraphs must keep working. Stored text must still read correctly everywhere it is used.

---

## Part 3 — Mirror Reports become layered insights (critical)

### Why

- **Owner:** reports have turned into summaries of whatever was written in the period. Early users call the feature useless and not worth opening. They want insights about themselves that they could not see on their own: topics, habits, indications, correlations.
- **From current-state:** a report is an overall account followed by the seven Personal Wellbeing Index areas. Sections are editable and the person's edit wins. The previous report is carried forward in full as the long-term memory, with up to 12 earlier period notes. Entry summaries reach back two periods (prompt v4). Known fault: the last run characterised figures in its own words.
- This is the owner's first real attempt at a structure for the report. It will be tuned with feedback, so keep the structure and the prompt easy to revise.

### The new report

1. **No seven-area structure.** Reports are no longer organized by PWI areas. The PWI card in Trends is unaffected.
2. **Header.** States the window of time and how many of each type of entry the report is based on: entries, check-ins, frameworks.
3. **Data overview.** A short, general description of what was used. Do not source every item. Do not overwhelm the reader.
4. **Three layers,** each labeled so the reader knows how much assumption it carries.
   - **First layer: quantitative.** When entries were written (dates and times), and framework and check-in scores over the period. Once Part 4 lands, the period's pattern numbers too. Quantities only (rule 10).
   - **Second layer: topics.** What the user wrote about. What recurs, and what looks important or useful. How often each comes up, and how topics line up with positives and stressors. Themes come from the user's own words, not a preset list. The user's own categories (item 12) may contribute but are not required. Counts are quantities. Any statement of correlation needs a floor and shows its numbers.
   - **Third layer: higher-risk inferences.** Insights, implications and inferences drawn from the user's data over time: patterns, quantities, Facts, Threads and the Profile. It also carries associations between the Trends patterns and entry content, framework scores or check-ins. It opens with a clear disclosure of the risk and of how much is AI inference. It is worded as possibility, not fact. This is the one place rule 10 does not apply.
5. **Period against history.** A report covers its period and compares it against the user's full history.
   - Keep the bounded input from prompt v4. Do not go back to reading every entry summary.
   - Full history reaches the report through the carried-over report, the period notes, Threads (below), and the all-time Trends numbers from Part 4.
6. **Profile and Facts as context.** The report reads the user's Profile and their Facts, so entries are read in the light of what the user has said about themselves.
   - **Owner:** Facts are written by the user as personal context. They stay that way.
   - **Owner:** a report does not have to say which goal or fact an insight relates to. No forced connections. Correlations appear only where they come up on their own.

### Threads: what Refine records and tracks

- **Owner:** Threads have no function today. Use them for the information Refine records and tracks in Mirror: what keeps coming up across the user's entries.
- When a report runs, record the recurring topics from the second layer as Threads, and update the ones already there.
- A thread tracks one topic over time: a short description, in the user's own words where possible, with when it first appeared, when it last appeared, and how many entries it has come up in. Quantities only.
- A thread records a recurring topic. It is not an inference about the person. Nothing from the third layer is written to Threads.
- Threads are read alongside the Profile and Facts. No forced links between them.
- Threads recorded by Refine are marked as such, apart from anything the user typed. The user can edit or remove any thread, and a removed thread is not recorded again. **Propose** how.
- Later reports read the Threads. This is part of how full history reaches a report.
- Sensitive entries never feed a thread (item 13).
- Use the existing `thread` kind and `entry_derived` source if they fit. See Part 0, question 15, and **propose** whether the unused Keep controls are reused or removed.
- Show the owner sample threads from real data before this ships. Wording is `[COPY]`.

### Editing, carry-over and assessment

- Reports are read-only this round. **Owner decision:** reports step away from always-editable until their input and output behavior is settled.
- Turn report editing off. Keep the editing code. Edits users already made stay stored and stay shown on those earlier reports.
- A third-layer inference must never reach a later report as established fact. **Propose** how the carry-over treats it: leave it out, or carry it labeled as an earlier unconfirmed inference.
- The user can still submit an assessment of a report. See Part 0, question 12. **Propose** changes to the criteria if they no longer fit. Do not make them unasked.
- Reports already stored stay as they are and stay readable. Do not regenerate them.

### Before it ships

- Show the owner the full prompt.
- Show sample reports generated from real data with `npm run mirror:once`. Include a first report: current-state says that path has never been exercised.
- Report the cost per report before and after with `--measure`. Say which model you recommend for the third layer and why.
- The first two layers must not characterise figures in their own words.
- Layer names, the disclosure and the header wording are `[COPY]`.

**Check:** the owner reads a sample report from their own account and finds at least one thing in it they had not noticed themselves.

---

## Part 4 — Trends holds the patterns

### Background

- **From current-state:** Trends charts check-ins and framework scores. It computes on view and has a range picker (1 month, year to date, all, custom). `build-notes.md` holds an open proposal arguing that what Memory was meant to generate may belong in Trends.
- **Owner:** this part and Threads (Part 3) are the answer to that proposal. Computed patterns live in Trends. Recurring topics live in Threads.

### New numbers

All are computed directly from the data, with no AI.

- **When the user writes:** time of day and day of week.
- **How often:** entries per week.
- **Entry length:** average word count. Compute it at analysis time. The per-entry word count display stays removed.
- **Time to log an entry:** only if it can be measured honestly. Drafts resumed later distort elapsed time. Report what is possible.
- **Top 5 categories by frequency,** from the user's own categories (item 12). No card when the user has none.

### How they show

- Each number shows for the selected range beside the all-time figure. Add the current report period as a range choice.
- Quantities only. For example "4 per week · all time 3", never "more than usual".
- The owner's original wording was that Trends refreshes on the Mirror Report cadence. Current-state says Trends computes on view, so this package keeps that. All-time figures mean reading every entry. **Propose** how to keep that affordable, for example computing them on the daily job and storing the results.
- **Propose** a floor for each new number.

### How the report uses them

- The report's first layer reads the same computation for its period.
- The third layer reads the numbers to look for associations.

### Dependencies

- Time of day and day of week depend on 1A.
- Sensitive entries are left out of every number.
- Mark the `build-notes.md` proposal resolved.

---

## Part 5 — Goals and guided prompts (critical)

### Goals and a fuller Profile

- **Owner:** the Profile today is in effect one large block of text. There is no real place for goals. It needs more work: probably an onboarding flow, or a larger and more comprehensive Profile section.
- **From current-state:** the Profile is stored as one JSON document of tendencies, goals and background. See Part 0, question 14.
- **Requirement:** the user has a proper place to set out their goals for journaling, reflection and personal growth, as part of a more complete picture of themselves. They can fill it in during onboarding and change it from the Profile at any time.
- **Propose** the structure before building: the sections of the Profile, how goals are captured, and the onboarding steps and questions that fill them in. Show it to the owner. All wording is `[COPY]`.
- Existing Profile text is preserved.
- The Profile, goals included, is context the report and Threads read (Part 3).

### Guided prompts

- **From current-state:** guided reflections are listed as deferred. The owner's decision of 2026-11-11 brings this form of them into the round.
- **Purpose (owner):** deeper, guided context on topics that matter to the person, and guidance for how to write about sensitive or important areas. The person tells their own story over several entries, as they might to a trusted listener.
- When writing an entry, the primary option stays open-ended, as now. The second option is a guided prompt. The user picks a category or asks for a random one.
- A guided entry is a normal entry: same editor, autosave, completion, summary, safety classification and place in Reflections.
- It records which prompt category it answered, as a stable key plus the version of the prompt set. Additive.
- For that entry, Footholds show the category's questions.
- The user can write many entries on the same category over time.
- The prompt shows on the entry when it is read back.
- The report may use the prompt category as context.
- **Content:** Appendix A. It is a draft the owner has not approved, so it ships with `[COPY]` markers. Keep the definitions in one place in code, versioned, the way frameworks are. Category keys are frozen once used.

---

## Part 6 — Categories and the sensitive flag

### Item 12. Entry categories belong to the user

- **Intent (owner):** an entry may be about a topic it never names. The user tags it so they can find it, reread it and reflect on it later.
- The app does not suggest or assign entry categories. They are entirely the user's.
- The user adds, changes and removes categories at the entry header and on the entry's card in Reflections.
- An entry can carry more than one. The user can create a category while tagging, and rename or delete categories.
- Reflections can be filtered by category. The filter has to stay usable as the number of categories grows. **Propose** how.
- The preset categories already on existing entries stay, as the user's editable starting categories. Plan the backfill and show it before running it.
- Category names are the user's words. Encrypt them.
- The app's own category output is no longer used for entry categories. Report what else depends on it (Part 0, questions 5 and 6).
- The summariser must keep recording topics in the writer's own words, because the report's second layer needs them. If that takes a summariser prompt change, show it for approval and say what re-summarising it triggers.

### Item 13. Sensitive flag

- The user can flag and unflag an entry as sensitive from the entry header. Wording is `[COPY]`.
- A flagged entry is always left out of the following. There is no per-report choice this round.
  - Mirror Reports, including through carried-over material.
  - Threads. A flagged entry never feeds a thread, and flagging removes any thread that came only from that entry. Facts are typed by the user and are not affected.
  - Trends numbers.
  - Clinical-style exports. None exist today. The rule stands for when they do.
  - Personal Footholds drawn from past entries. This surface came from current-state. Proposed default, owner confirms.
- An entry may be flagged after earlier reports already drew on it. **Propose** how later reports stop carrying its content.
- Unflagging makes the entry eligible again from the next run.
- Safety classification still runs on flagged entries.
- Proposed default, owner confirms: the admin phrase reveal in Part 8 is not offered for flagged entries.
- **First,** list every place an entry's content flows and how each one will treat a flagged entry. The owner reviews the list before you build.
- No PIN this round.

---

## Part 7 — Check-in dates and the landing checklist

### Item 9. Check-ins for other dates

- The user can record or update a check-in for a date other than today.
- The view opens on today, shown as day of week plus date. A date selector changes the date. Today and past dates only.
- One check-in per date. Choosing a date that already has one opens it to update.
- This needs a "date this check-in is for" in the user's local date, separate from when it was recorded. Additive.
- Backfill existing rows. Report any dates that already hold more than one check-in (Part 0, question 9) and **propose** how to handle them before touching data.
- Trends, the habit grid and "logged today" read that date.

### Item 14. Landing page checklist

- The landing page shows a daily tasks checklist. For today: has an entry been submitted, has a check-in been recorded. Each line links to its action.
- An "upcoming" section lists frameworks coming due.
- The due interval is set per framework and stored with the framework. Defaults: 2 weeks, and monthly for the PWI. **Owner decision.**
- The PWI's "[COPY] Every 3 months" string must follow the interval.
- **Propose** how a framework that has never been taken is shown.
- "Today" is the user's local date (1A).
- The checklist shows current state only. No streaks and no counts of missed days.
- Not this round, but do not block them: one sequential flow that completes the day's actions together, and tasks the user adds for themselves.

---

## Part 8 — Safety log

- **Purpose (owner):** the log exists to confirm the classifier is working. It is not for reading what users wrote.
- **Organization:** filter by tier, date range, source (entry, edit, framework) and reviewed status. Add search. **Propose** the grouping.
- **Each row** shows the classifier's reasoning in general terms: what about the entry justified the tier. No quoted entry text.
- **Phrase reveal:** the admin can reveal the de-identified verbatim phrases that triggered the tier.
  - They appear only when the admin chooses to reveal them.
  - They carry no writer identity, and names are masked.
  - A reveal is not logged. **Owner decision:** this view is purely diagnostic for early testing. Record it in the docs as a stated exception to the access-log rule.
- The classifier has to output its reasoning and the trigger phrases. That is a classifier prompt change: owner approval, version bump.
- Phrases are entry text. Store them encrypted.
- Earlier rows have neither reasoning nor phrases. Show them as such.
- Add a legend defining each tier if one does not exist. Wording is `[COPY]`.
- If rows still show entry text, remove it. The owner asked for that in September.

---

## Part 9 — Docs to update

- `docs/current-state.md`, at the end of every session. Correct its summary timing now: summaries are generated on submit.
- `CLAUDE.md`:
  - The third layer as the stated exception to rule 10.
  - The time-zone approach from 1A.
  - The safety-log reveal as an unlogged exception.
  - The two stale lines current-state lists: the system-prompt page that does not exist, and the conversation-loop and voice notes.
- `build-notes.md`: the Memory and Trends proposal, resolved by Parts 3 and 4.
- The planning doc and limitations register: reports are no longer organized by PWI areas, and guided prompts are no longer deferred.

---

## Appendix A — Guided prompts starter set

Draft. The owner has not approved the wording. Everything here ships marked `[COPY]`.

Each category has an opening prompt and Footholds questions. Questions run from easier to deeper. They are optional supports: the user answers any of them, in any order, across as many entries as they like.

**1. Family**
Opening prompt: Tell me about your relationship with your family.
- Who do you mean when you say "family"?
- What was home like when you were growing up?
- Who are you closest to now, and what makes that work?
- Where is there tension or distance? When did it start?
- What did your family teach you about handling conflict or hard feelings?
- What do you wish they understood about you?
- What would you want these relationships to look like a year from now?

**2. Close relationships**
Opening prompt: Tell me about the people you're closest to.
- Who do you turn to first when something goes wrong? When something goes right?
- What does a good day with them look like?
- What do you find hard to say to the people closest to you?
- When you disagree, what usually happens?
- Is there a relationship that has changed lately? What changed?
- What do you give in your relationships, and what do you get back?

**3. Work**
Opening prompt: Tell me about your work and how it sits with you.
Helper line: Work can mean a job, study, caregiving, or whatever fills your days.
- What does a typical day ask of you?
- Which parts give you energy, and which drain it?
- When work stress shows up, where do you notice it first?
- How do you get along with the people you work with or for?
- What did you once want from work? What do you want from it now?
- Where does work end and the rest of your life begin?

**4. How you see yourself**
Opening prompt: Tell me about how you see yourself.
- How would you describe yourself to someone who has never met you?
- How would someone who loves you describe you? Where do the two differ?
- What are you good at that you rarely give yourself credit for?
- When are you hardest on yourself? What do you say to yourself then?
- Where did that voice come from?
- When do you feel most like yourself?

**5. Stress and coping**
Opening prompt: Tell me about what weighs on you and how you carry it.
- What has been taking up the most room in your head lately?
- How does stress show up for you: in your body, your sleep, your mood, your patience?
- What do you do when it builds? What helps, and what only helps for a moment?
- Which pressures are in your control, and which are not?
- Who knows how much you are carrying?
- Think of a hard stretch you got through. What got you through it?

**6. Belonging and support**
Opening prompt: Tell me about where you feel you belong.
- Where do you feel most at ease being yourself?
- Which groups, places or communities are you part of? Which did you used to be part of?
- When have you felt like an outsider? What was that like?
- Who really knows you?
- What do you offer the people and communities around you?
- What kind of connection do you wish you had more of?

**7. Turning points**
Opening prompt: Tell me about a time that shaped who you are.
- What happened, and how old were you?
- What did you believe about yourself or the world before it? And after?
- Who was there for you then? Who wasn't?
- What have you lost along the way that you still think about?
- What did that time teach you that you still use?
- If you could say one thing to yourself back then, what would it be?

**8. What you want to change**
Opening prompt: Tell me about what you want to be different.
- If things were going well a year from now, what would be different?
- What have you already tried? What happened?
- What gets in the way when you try to change this?
- What would you gain if it changed? What might you have to give up?
- Who or what could help?
- What is one small part of this that feels possible now?

---

## Appendix B — Not in this round

For context only. Do not build these. Do not block them.

- **Account email, then phone, for verification and password reset.** Email is the higher priority. Current-state shows admin-issued reset codes already exist; email would deliver them without the admin. Cost snapshot, November 2026: Resend free plan 3,000 emails a month. Twilio about $20 one-time, about $3 a month, about 1.2 cents per text.
- **Responses to third-layer insights.** Later, written feedback or notes in the report assessment become part of the context built about the user, and a data source for future reports.
- **Editing reports.** Turned off this round. It returns once report input and output behavior is settled.
- **A PIN to change the sensitive flag,** and a way to run more than one type of report, with and without sensitive entries.
- **One sequential daily flow** that completes the entry, the check-in and any due frameworks together. Early users asked for this over going back and forth from the landing page.
- **User-added tasks** on the landing checklist.
