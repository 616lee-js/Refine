# Refine — UX Observations

Input to the eventual system prompt and interaction design review. Entries are logged as encountered during testing. Do not edit prompts or UI copy in response to individual entries — this feeds a deliberate, focused review.

## Entry format

**OBS-### | YYYY-MM-DD | Status: open / resolved YYYY-MM-DD**
Description. Session/entry IDs if applicable.

---

## Observations

### OBS-001 | 2026-05-07 | Status: resolved 2026-05-07

**Session ending — no way to conclude a session from chat UI**

Phase 3 scope gap: the session lifecycle (start → check-in → body → end) was fully specified but the end transition was missing from the chat UI. There was no way to conclude a session; the only exit was Sign out. Resolved in Phase 3 by adding an "End session" button below the message input. Clicking it streams a contextual closing response through the full orchestrator pipeline (using the last user message's tier for safety context), then marks `sessions.endedAt` in the DB and disables further input.

---

### OBS-002 | 2026-05-07 | Status: resolved 2026-05-07

**Session history — no way to view past sessions for verification**

No session list or session detail view existed after Phase 3 launch. Could not verify data accumulation, revisit prior session content, or confirm session ending was working correctly. Resolved in Phase 3 by adding `/sessions` (list: date, type, active/ended status) and `/sessions/[id]` (debug detail: check-in data + all decrypted entries with source, sequence, and tier label). Content access on the detail page is audited to `content_access_log`.

---

### OBS-003 | 2026-05-07 | Status: open

**Tone, cadence, and response quality noticeably off in early testing**

Specific observations to be added as testing continues. Deferred to a focused prompt review phase rather than piecemeal adjustment during Phase 3. This entry tracks the standing concern. Session/entry IDs will be appended as specific examples are captured during testing.

---

### OBS-005 | 2026-05-08 | Status: open (deferred to Phase 7)

**Scheduled session lifecycle — unused/skipped sessions**

Design question: what happens to a scheduled session that isn't used? If a user creates a scheduled session, never shows up, and later tries to schedule another — should the old one expire? Can it be rescheduled? Silently dropped? This requires product decisions about session scheduling, reminders, and grace periods that belong with Phase 7 (scheduling) work rather than Phase 4. Not blocking current build; flagged here so it surfaces at the right time.

---

### OBS-006 | 2026-05-08 | Status: resolved 2026-05-10

**Skip button redundant on as-needed check-in**

The as-needed check-in textarea already has an optional placeholder ("Optional — you can skip this"). The Skip button added a redundant path that called `startSession(true)` — identical in result to submitting the empty textarea. Resolved by removing the Skip button and widening the Start button to full width. `startSession(false)` already skips empty `presentText`.

---

### OBS-007 | 2026-05-08 | Status: resolved 2026-05-10

**Voice pause timer could fire mid-speech**

The pause countdown reset only on `onUtterance` (finalized transcript), not on `onInterim` (in-progress speech). A prior final's timer could expire while the user was still speaking, triggering too early. Resolved by calling `clearPauseTimer()` in `onInterim` when interim text is non-empty — any speech activity (interim or final) resets the countdown.

---

### OBS-008 | 2026-05-08 | Status: resolved 2026-05-10

**Voice transcripts lack punctuation and capitalization**

Web Speech API does not reliably add punctuation to final transcripts. Stored entries and text sent to Claude were lowercase mid-sentence fragments. Resolved by post-processing each final utterance through `addPunctuation()` in `use-voice-session.ts` — capitalizes first letter, appends a period if no sentence-ending punctuation is present.

---

### OBS-009 | 2026-05-08 | Status: resolved 2026-05-10

**Sessions nav link absent from chat header**

The home page always shows a Sessions link; the chat session view did not. Users had no way to navigate to their session history while in a session. Resolved by adding the Sessions link to the chat.tsx header alongside Sign Out.

---

### OBS-010 | 2026-05-08 | Status: resolved 2026-05-10

**"Present:" label on session detail page unclear**

The debug session detail view labeled `checkIn.presentText` as "Present:" — a database field name, not a human label. For as-needed sessions this field captures the response to "What's bringing you here today?". Renamed to "What brought you here:" to match the check-in form.

---

### OBS-011 | 2026-05-08 | Status: resolved 2026-05-10

**Sessions persist as "Active" after signout or navigation away**

Sessions without an explicit "End session" action remained in Active state indefinitely. Two fixes: (1) Logout route now stamps `endedAt` on all active sessions before destroying the auth cookie. (2) Chat component sends `navigator.sendBeacon` to `/api/sessions/[id]/abandon` on unmount and on `beforeunload` — abandon endpoint marks the session ended if it has user entries, or deletes it (cascade) if it has none. Server is idempotent; if session is already ended, beacon is a no-op. Note: signout auto-end does not generate a closing AI response — see LIM-013.

---

### OBS-004 | 2026-05-08 | Status: open

**Layer 2 system prompt uses text-chat language, off-paradigm for voice sessions**

The Layer 2 system prompt was written under the assumption of text chat ("write", "share", "read back", etc.). With Phase 4 voice mode added, Claude's responses will be received as text but the user's input is spoken. The system prompt language may produce responses that implicitly ask the user to write things down, reference the "text", or otherwise assume a reading/typing interaction. This should be addressed in the dedicated prompt review phase (OBS-003 scope). Do not patch incrementally — collect specific voice-session examples first and revise in a focused pass.

---

### OBS-012 | 2026-05-11 | Status: resolved 2026-05-11

**Phase-ordering gap — memory extraction scoped to Phase 5 against wrong data source**

Phase 5 Step 11 (memory extraction) was originally designed to run against raw entries. Caught during the Phase 5 → Phase 6 transition: extraction should consume structured Cabinet 2 summaries, not raw entries. Building it against raw entries first would lock in the wrong data source and require a re-architecture once summaries exist. Resolved by integrating memory extraction into Phase 6, designed alongside background summarization. The Phase 6 build will treat summaries as the primary input and draft the extraction prompt in planning review before build starts.

---

### OBS-013 | 2026-05-11 | Status: resolved 2026-05-11

**Phase 5 scope gap — profile settings page built but not linked from primary navigation**

`/settings/profile` was implemented as part of Phase 5 (tendencies, goals, background — all fields matching onboarding, saving to `user_profiles`, feeding Layer 4 correctly). Not linked from any primary nav surface. Only reachable via onboarding footer text ("update anytime in Profile Settings") and memory page header. Post-migration smoke test caught this: after onboarding, no path to view or edit profile without knowing the URL directly. Resolved by adding "Profile" link to primary nav on home (both steps), reflections list, and chat header. Layer 4 feed confirmed correct — profile is re-read from DB on every Claude call, so updates propagate immediately.

---

### OBS-014 | 2026-05-11 | Status: resolved 2026-05-11

**Nav inconsistency across pages — each page had a different subset of nav links**

Home: Reflections / Profile / Sign out. Reflections list: Profile / ← New reflection. Profile: Reflections / Memory / ← Home. Memory: Profile / ← Home. Reflection detail: ← Reflections only. Chat: Reflections / Profile / Sign out. No consistent set of top-level destinations, no active-page indicator, sign out missing from several pages. Resolved by standardizing to `Reflections | Mirror | Profile | Sign out` across all pages, with active page indicated by underline + slightly darker text. Reflection detail shows Reflections as active (sub-page).

---

### OBS-015 | 2026-05-11 | Status: resolved 2026-05-11

**Memory kind tabs as primary organization — tabs favor categories over recency**

Primary UI organized by kind tabs (Facts / Open threads / Preferences / Diagnostic context / Other), requiring users to click through tabs to see all entries. Recency — the natural read order for reviewing what the app has learned — was only visible within each tab. Resolved by: replacing tabs with a flat list sorted most recent first; showing kind as a small tag on each entry; adding a secondary filter dropdown to narrow by kind when needed. Add entry form includes kind selector. Bulk delete by kind available when filter is active. Data model and API unchanged.

---

### OBS-016 | 2026-05-11 | Status: open

**Diagnostic context kind may warrant distinct display framing**

"Diagnostic context" is qualitatively different from other memory kinds — it captures clinical labeling the user has shared (diagnoses, conditions, clinical history) rather than life information or interaction preferences. Displaying it in the same list as "Fact: I prefer mornings" risks decontextualizing sensitive self-disclosure. There may be a case for a separate surface or explicit framing ("Information you've shared about your mental health context"). Deferred to v1.5 review — collect usage examples during v1 self-testing before deciding on a design response. Do not address in v1.

---

### OBS-017 | 2026-05-11 | Status: resolved 2026-05-11

**Regression — nav consolidation removed the only path to start a new reflection**

Unifying all pages to `Reflections | Mirror | Profile | Sign out` dropped the "← New reflection" link that previously appeared on the reflections list page. The home page (`/`) is the new-reflection flow (type selector → check-in), but no nav link points to it, leaving no discoverable path to start a reflection from any page other than `/`. FAB considered and rejected — deliberate journaling context argues against ambient creation affordance. Resolved by adding a "New reflection" button as a primary content action at the top of the reflections list (links to `/`), and updating the empty state to include a CTA. Home page type selector unchanged — it remains the entry point.

---

### OBS-018 | 2026-05-11 | Status: resolved 2026-05-11

**Two CTAs simultaneously visible on Reflections page in empty state**

The "New reflection" button (always rendered) and the "No reflections yet. Start your first →" inline link (rendered when `rows.length === 0`) both appeared simultaneously when no reflections existed. Bug introduced when adding the button in OBS-017 fix — the empty-state link was not removed. Resolved by dropping the inline link; the button above the list handles both empty and non-empty states.

---

### OBS-019 | 2026-05-11 | Status: resolved 2026-05-11

**No persistent path to start a new reflection from Mirror, Profile, or detail pages**

"New reflection" button was only on the Reflections list. From Mirror, Profile, or a reflection detail page, no path existed back to `/` (home = type selector). Initial fix attempt (brand text as link to `/`) was rejected — too subtle, not a labeled action. Resolved by adding a "New reflection" bordered button (`px-3 py-1 rounded-lg border border-stone-200 text-xs text-stone-600`) as a nav item before Sign out on: Reflections list, Reflections detail, Mirror, and Profile pages. Brand text reverted to plain `<h1>`. Home page excluded (IS the type selector); chat excluded (mid-reflection navigation risk).
