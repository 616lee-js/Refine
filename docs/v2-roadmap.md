# Refine — v2 Roadmap

Capabilities deferred to v2. Each item has a brief note on why it was deferred and what it depends on.

---

## Multi-user auth system

v1 uses single-user passphrase auth. v2 needs proper per-user accounts before most items below become possible.

- User registration, login, session management per-user
- Per-user encryption keys (v1 uses a single ENCRYPTION_KEY for all data)
- Password reset, account recovery

---

## Superuser / admin functionality

Depends on: multi-user auth

- Admin account role with elevated access
- Ability to view app-level usage stats (aggregate, not per-user content)
- User management (suspend, delete, export)
- Safety log review interface (reviewer_notes, reviewed flag — schema supports this in v1, but UI deferred)

---

## In-app metrics and monitoring

Depends on: multi-user auth

- Session frequency, streak, usage over time (per-user, shown to user)
- Aggregate stats for product owner (deidentified): active users, session lengths, tier distribution in safety_log
- No per-user content access by admin without explicit consent mechanism

---

## Deidentified review of summaries across users

Depends on: multi-user auth, admin role, consent framework

- Product owner / clinical reviewer can view deidentified session summaries for quality review
- Requires explicit opt-in consent from users
- Governed by clinical review process before enabling

---

## Secure export / share links

Depends on: multi-user auth

- User-initiated export of their journal entries (encrypted download or plaintext PDF)
- Optional: share link for a single session summary (time-limited, revocable)
- Governed by the same encryption + auth model as the app

---

## Session lifecycle management

v1 auto-creates sessions and doesn't expose session controls to the user. v2:

- User-initiated session start and end
- Named or tagged sessions
- Session history browser

---

## Clinical review gate (v2 prompt changes)

v1 prompt files are marked "clinical review required before v2." The review gate is:

- All Layer 2 and Tier 2/3 Layer 3 content reviewed by a qualified mental health professional before v2 release
- Sign-off documented in `docs/prompt-changelog.md`
- Safety log reviewed against real session data before widening access

---

*Update this file as additional v2 items are identified.*
