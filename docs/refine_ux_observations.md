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
