import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * ── Naming ────────────────────────────────────────────────────────────────────
 * A **journal entry** is one complete piece of the user's writing. "Entry" has
 * exactly one meaning in this schema — there is no inner per-message table for it
 * to collide with, which was the central problem in the previous design.
 *
 * "Reflection" is product language for the practice (reflective journaling) and
 * remains the user-facing word in the UI and routes. It is deliberately not a
 * data noun here.
 *
 * ── Two distinct shapes ───────────────────────────────────────────────────────
 * `journal_entries`         free-text writing, no AI in the surface
 * `questionnaire_responses` structured self-reports with scored answers
 *
 * They are kept structurally separate because they are structurally different.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * How an entry was composed. `voice` and `mixed` are retained for when dictation
 * returns — see src/lib/flags.ts. Note there is no `claude` value: entries hold
 * only the user's own words.
 */
export const entryModalityEnum = pgEnum("entry_modality", [
  "text",
  "voice",
  "mixed",
]);

export const memoryKindEnum = pgEnum("memory_kind", [
  "fact",
  "thread",
  "preference",
  "diagnostic_context",
  "other",
]);

export const memorySourceEnum = pgEnum("memory_source", [
  "user_added",
  "claude_inferred",
  // Derived from a journal entry. Was `session_derived`, then
  // `reflection_derived`; now named for what it actually points at.
  "entry_derived",
]);

export const feedbackTypeEnum = pgEnum("feedback_type", ["bug", "request"]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "new",
  "completed",
]);

// ── Identity ─────────────────────────────────────────────────────────────────

/**
 * email_encrypted: AES-256-GCM ciphertext (format iv:tag:ciphertext, base64).
 * email_hmac: HMAC-SHA256 of lowercased+trimmed email, hex. Used for login
 *   lookups because the address itself is encrypted and cannot be queried.
 *   Never change EMAIL_HMAC_KEY once users exist — existing hashes cannot be
 *   recomputed, and every account silently appears not to exist.
 * display_name: plaintext in v1 (not PII-grade sensitive; v2 may encrypt).
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  emailEncrypted: text("email_encrypted").notNull(),
  emailHmac: text("email_hmac").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  preferences: jsonb("preferences").notNull().default({}),
});

/**
 * Invite codes — the only path to an account.
 *
 * Single-use by construction: `used_at` and `used_by_user_id` are written in the
 * same transaction that creates the user, with the code row locked FOR UPDATE, so
 * two concurrent signups cannot consume one code.
 */
export const inviteCodes = pgTable("invite_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByUserId: text("used_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/**
 * User profile — PHI-grade content isolated from the auth-adjacent users row.
 * One row per user. Encrypted as a single JSON blob so the shape can evolve
 * without migrations. Fields inside: tendencies, goals, background.
 */
export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedContent: text("encrypted_content"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Journal entries (Cabinet 1) ──────────────────────────────────────────────

/**
 * One row per journal entry. The user's own writing — no AI content, ever.
 *
 * ── Lifecycle ─────────────────────────────────────────────────────────────────
 * completed_at NULL              draft. Autosaved as the user writes; resumable.
 * completed_at set               user marked it done. Classification runs here,
 *                                and again on any later edit.
 * deleted_at set                 in trash. Hidden from the entry list, restorable
 *                                for 30 days.
 * purged_at set                  content destroyed. `encrypted_body` is NULL and
 *                                the row survives as a shell.
 *
 * ── Why purge keeps the row ───────────────────────────────────────────────────
 * safety_log references this row. Deleting it would cascade and destroy the
 * safety record, which is a log and must outlive the content it describes. So
 * purge nulls the body and sets purged_at: the user's words are genuinely gone,
 * the detected tier is not. Any query listing entries must exclude rows with
 * purged_at set — they are bookkeeping, not entries.
 */
export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** AES-256-GCM ciphertext. NULL only after purge. */
  encryptedBody: text("encrypted_body"),
  /**
   * Optional, user-set. Encrypted — a title summarises the entry and is
   * therefore journal content, not metadata.
   *
   * NULL means untitled; the archive falls back to the date. Deliberately NOT
   * derived from the body: rendering excerpts for a list would mean decrypting
   * every entry on every page view, and each of those is a deliberate
   * decryption that content_access_log is supposed to record — which would
   * bury the audit log in noise it was never meant to carry.
   *
   * When Phase 6 lands, AI-suggested titles populate this same column with the
   * design's rename affordance intact. Nothing here changes.
   */
  encryptedTitle: text("encrypted_title"),
  modality: entryModalityEnum("modality").notNull().default("text"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  /** Highest tier across the entry's paragraphs at the last classification. */
  tierClassification: integer("tier_classification"),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  /** Phase 6 memory-extraction lifecycle: null → pending → running → succeeded/failed. */
  extractionStatus: text("extraction_status"),
  /**
   * Consecutive failed summarisation attempts.
   *
   * The summariser's work queue is derived by joining against
   * `journal_entry_summaries` — an entry is due when it has no summary, or one
   * older than its own `updated_at`. That derivation is self-healing but has no
   * natural stopping point, so an entry the model chokes on would be retried
   * every single run forever. This caps it (see SUMMARY_MAX_ATTEMPTS).
   *
   * Reset to 0 on success and whenever the entry is edited, since new content
   * deserves fresh attempts.
   */
  summaryAttempts: integer("summary_attempts").notNull().default(0),
  /**
   * Which summariser prompt version those attempts were spent under.
   *
   * Without this, the cap and the reflow fight each other: an entry that failed
   * five times under prompt v1 would be excluded forever, including from the
   * v2 reflow that might well have summarised it fine. Attempts are therefore
   * consecutive failures *under one prompt version*, not for all time — a new
   * version is a new trial and earns fresh attempts, exactly as an edit does.
   *
   * The cap still bites: five failures under v2 stops v2 retrying. Poison-entry
   * protection is preserved, it is just scoped to the prompt that was failing.
   */
  summaryAttemptVersion: text("summary_attempt_version"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cabinet 2: a narrative summary generated after an entry is completed.
 *
 * Derived data, always regenerable from Cabinet 1 — which is why
 * `generation_version` is recorded and why a stale row is simply overwritten
 * rather than versioned.
 *
 * ── One encrypted blob, not a column per field ────────────────────────────────
 * `encrypted_content` holds the whole summary object: prose, topics, people,
 * quotes with offsets, and a `thin` flag. Same reasoning as
 * `questionnaire_responses.encrypted_answers` — everything here is ciphertext,
 * so per-field columns buy nothing SQL can filter or aggregate on, while a blob
 * absorbs shape changes without a migration. Phase 6 will almost certainly want
 * fields nobody has thought of yet.
 *
 * See src/lib/summaries/types.ts for the shape stored inside it.
 *
 * ── One row per entry ─────────────────────────────────────────────────────────
 * `journal_entry_id` is UNIQUE. An entry that is edited after completion gets
 * its summary regenerated and upserted onto the same row; without the
 * constraint, regeneration would either duplicate rows or leave "which summary
 * is current?" ambiguous.
 */
export const journalEntrySummaries = pgTable("journal_entry_summaries", {
  id: text("id").primaryKey(),
  journalEntryId: text("journal_entry_id")
    .notNull()
    .unique()
    .references(() => journalEntries.id, { onDelete: "cascade" }),
  /** AES-256-GCM ciphertext of the JSON summary object. */
  encryptedContent: text("encrypted_content").notNull(),
  /**
   * When this summary was produced. The work queue compares it against the
   * entry's `updated_at`: older means the entry has been edited since, and the
   * summary is stale. That comparison IS the regeneration rule — there is no
   * status column to set, and nothing can get stuck half-done.
   */
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Derived from the summariser prompt's header — see promptVersion(). */
  generationVersion: text("generation_version").notNull(),
});

// ── Questionnaires ───────────────────────────────────────────────────────────

/**
 * One row per questionnaire taken.
 *
 * ── Definitions live in code, not here ────────────────────────────────────────
 * `src/lib/questionnaires/` holds one file per instrument: its questions,
 * response options, and scoring. Adding a questionnaire is a new file — no
 * migration, no seeding, nothing to drift between environments. Instrument
 * wording is reviewable in a git diff, which matters for clinical review, and an
 * instrument that cannot be licensed is simply a file that is not added.
 *
 * `questionnaire_slug` and `questionnaire_version` name which definition was
 * answered. Version is recorded because instruments get revised and old
 * responses must stay interpretable against the wording actually presented.
 *
 * ── Why one encrypted blob instead of a row per answer ────────────────────────
 * A per-item table exists to allow SQL-level longitudinal queries. Encryption
 * makes that impossible regardless — you cannot filter on ciphertext — so the
 * item table would add a join and a second purge path while buying nothing.
 * Aggregation happens in application code either way.
 *
 * These values are encrypted because a PHQ-9 total of 22 is itself a clinical
 * datapoint about a person, arguably more sensitive than prose. The tradeoff
 * accepted: trend computation decrypts N rows in the app rather than aggregating
 * in Postgres. Fine at a handful of responses per user per month; revisit if
 * questionnaires ever become high-frequency.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 * Some instruments carry safety items — PHQ-9 item 9 asks about self-harm. A
 * response can therefore produce a safety_log row, which is why safety_log
 * references this table as well as journal_entries.
 */
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Which instrument: e.g. "gad7", "daily_checkin". */
  questionnaireSlug: text("questionnaire_slug").notNull(),
  /** Which version of that instrument's definition was presented. */
  questionnaireVersion: text("questionnaire_version").notNull(),
  /** Encrypted JSON: { [questionKey]: number | string }. NULL after purge. */
  encryptedAnswers: text("encrypted_answers"),
  /** Encrypted JSON: { total, band, subscales? }. NULL after purge. */
  encryptedScoring: text("encrypted_scoring"),
  /** NULL while partially answered. */
  completedAt: timestamp("completed_at", { withTimezone: true }),
  tierClassification: integer("tier_classification"),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Layer 4 memory ───────────────────────────────────────────────────────────

/**
 * Persistent user memory, assembled into prompt context (Layer 4).
 *
 * State model: last_confirmed_at NULL + is_active true = proposed (awaiting the
 * user's confirmation); last_confirmed_at set = active. Only active entries are
 * used as context.
 *
 * is_active is a soft-delete flag distinct from genuine deletion — user-initiated
 * deletion removes the row outright, per the data-ownership principle.
 */
export const userMemory = pgTable("user_memory", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: memoryKindEnum("kind").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  source: memorySourceEnum("source").notNull(),
  /** The entry this was derived from, when it was derived rather than user-added. */
  journalEntryId: text("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
});

// ── Safety and audit ─────────────────────────────────────────────────────────

/**
 * Safety classification log — the product owner's record for reviewing
 * tier-detection accuracy. Holds no journal text: a tier, the classifier
 * version, and signal metadata only.
 *
 * ── Sources ───────────────────────────────────────────────────────────────────
 * A classification can originate from either shape, so both FKs are nullable and
 * `source` names which path produced it:
 *
 *   journal_entry   an entry marked done
 *   journal_edit    an already-completed entry edited and re-saved
 *   questionnaire   a questionnaire response containing a safety item
 *
 * Rows with source = "questionnaire" carry `questionnaire_response_id` and are
 * the ones to watch when an instrument includes an item like PHQ-9 item 9 —
 * they represent a scored safety signal rather than something the user wrote in
 * their own words, and warrant a different response path.
 *
 * `user_id` is stored directly and NOT nullable so a row stays attributable even
 * if its source FK is later nulled. Both source FKs are ON DELETE SET NULL
 * rather than cascade: the log must outlive the content it describes.
 */
export const safetyLog = pgTable("safety_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  journalEntryId: text("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
  }),
  questionnaireResponseId: text("questionnaire_response_id").references(
    () => questionnaireResponses.id,
    { onDelete: "set null" }
  ),
  /** Which path produced this classification. See the note above. */
  source: text("source").notNull(),
  tier: integer("tier").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  /** Per-chunk tiers, chunk count, and anything else useful for calibration. */
  rawSignals: jsonb("raw_signals").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewed: boolean("reviewed").notNull().default(false),
  reviewerNotes: text("reviewer_notes"),
});

/**
 * Audit log of deliberate decryption events — written whenever decrypted content
 * is surfaced to a user. PHI-grade handling means being able to answer "when was
 * this actually decrypted and shown", not merely "who could have".
 */
export const contentAccessLog = pgTable("content_access_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  journalEntryId: text("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "cascade",
  }),
  questionnaireResponseId: text("questionnaire_response_id").references(
    () => questionnaireResponses.id,
    { onDelete: "cascade" }
  ),
  accessedAt: timestamp("accessed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Human-readable label for the access point. */
  context: text("context").notNull(),
});

// ── Product feedback ─────────────────────────────────────────────────────────

/**
 * Bug reports and requests submitted from the in-app widget.
 *
 * ── There is deliberately no user_id ──────────────────────────────────────────
 * Not an oversight, and not a column waiting to be added. Submissions are
 * unattributed on purpose so that saying "this is confusing" costs nothing.
 * `POST /api/feedback` authenticates the caller — otherwise the endpoint is an
 * open spam target — and then discards the identity rather than storing it.
 *
 * ── "Anonymous" here means unattributed, NOT unlinkable ───────────────────────
 * A timestamp is enough to attribute a submission completely while there is one
 * user, and to narrow it hard across a handful of testers. Server logs and the
 * session that authorised the POST narrow it further. This must never be
 * described to a user as a privacy guarantee — it is an internal choice not to
 * record who said what, not a technical anonymity property.
 *
 * If real anonymity is ever needed, it is a different design: no authentication,
 * or submission through something the app cannot correlate.
 *
 * ── No FK means no cascade ────────────────────────────────────────────────────
 * Deleting an account leaves its feedback behind, because nothing links the two.
 * That is inherent to not storing the identifier, not a deletion bug to fix
 * later. Feedback carries no journal content, so nothing PHI-grade survives.
 *
 * ── Body is plaintext ─────────────────────────────────────────────────────────
 * Deliberate (2026-08-04): feedback is product commentary rather than journal
 * content, and plaintext keeps it searchable in SQL. The submission form asks
 * people not to include personal detail, which is the honest mitigation for a
 * free-text box — a box like this attracts it regardless, so anything sensitive
 * that lands here is sitting unencrypted and readable in the admin view.
 */
export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  type: feedbackTypeEnum("type").notNull(),
  body: text("body").notNull(),
  /** Moves between the two sections of the admin review page. */
  status: feedbackStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
