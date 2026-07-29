import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────

export const reflectionTypeEnum = pgEnum("reflection_type", [
  "scheduled",
  "as_needed",
  "guided",
]);

export const reflectionModalityEnum = pgEnum("reflection_modality", [
  "voice",
  "text",
  "mixed",
]);

export const entrySourceEnum = pgEnum("entry_source", [
  "user_voice",
  "user_text",
  "claude",
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
  // Renamed from "session_derived" — the Phase 5 terminology rename missed this
  // enum value because migration 0003 dropped only the session_type and
  // session_modality types, not memory_source. Changed while the deployment
  // database is still empty; after data exists it costs a migration.
  "reflection_derived",
]);

// ── Tables ───────────────────────────────────────────────────────────────────

/**
 * Multi-user-ready from Phase 3 onward.
 * email_encrypted: AES-256-GCM ciphertext (format: iv:tag:ciphertext, base64).
 * email_hmac: HMAC-SHA256 of lowercased+trimmed email, hex-encoded. Used for
 *   login lookups. Key is EMAIL_HMAC_KEY in env. Never change this key once
 *   users exist — existing HMACs cannot be recomputed without the original emails.
 * display_name: stored plaintext in v1 (not PII-grade sensitive; v2 may encrypt).
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
 * Signup is gated: no valid, unexpired, unused, unrevoked code means no account.
 * Cloud deployment brought tester access forward ahead of the v2 gate (LIM-006),
 * and this is what keeps that access to a known, bounded group.
 *
 * Single-use by construction: `used_at` and `used_by_user_id` are written in the
 * same transaction that creates the user, with the code row locked FOR UPDATE,
 * so two concurrent signups cannot consume one code.
 *
 * code:        the value typed at signup. Unique, case-normalised on lookup.
 * expires_at:  null means never expires.
 * revoked_at:  set by the CLI to disable a code that has not been used.
 * used_by_user_id: ON DELETE SET NULL — deleting a user must not delete the
 *   audit trail of which codes were consumed, but nor should it leave a
 *   dangling reference.
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
 * Cabinet 1: each reflection is a container for entries.
 * scheduled_for: set when reflection was pre-scheduled; null for as-needed.
 * extraction_status: memory extraction lifecycle.
 *   null     = not applicable (abandoned / no user entries / not yet run)
 *   pending  = queued after reflection end
 *   running  = extraction in flight
 *   succeeded = proposed memory entries saved
 *   failed   = extraction failed; raw output logged separately
 */
export const reflections = pgTable("reflections", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: reflectionTypeEnum("type").notNull(),
  modality: reflectionModalityEnum("modality").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  extractionStatus: text("extraction_status"),
});

/**
 * Structured check-in at reflection start. Shape varies by reflection type:
 *   as_needed  — mood: {}, present_text: optional ("what's bringing you here?"),
 *                intention_text: null, tier_at_start: null (inferred from body)
 *   scheduled  — mood: { rating: 1–5 }, present_text: required, intention_text: optional
 *   guided     — TBD (Phase 3 pause point; content worked through with product owner)
 */
export const checkIns = pgTable("check_ins", {
  id: text("id").primaryKey(),
  reflectionId: text("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  mood: jsonb("mood").notNull().default({}),
  presentText: text("present_text"),
  intentionText: text("intention_text"),
  tierAtStart: integer("tier_at_start"),
});

/**
 * Cabinet 1: individual message-level entries within a reflection.
 * encrypted_content: AES-256-GCM ciphertext (format: iv:tag:ciphertext, base64).
 * raw_audio_ref: local file path for voice entries; null for text.
 * tier_classification: safety tier of this message (null for claude entries).
 */
export const entries = pgTable("entries", {
  id: text("id").primaryKey(),
  reflectionId: text("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  source: entrySourceEnum("source").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  rawAudioRef: text("raw_audio_ref"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tierClassification: integer("tier_classification"),
});

/**
 * User profile — PHI-grade content isolated from the auth-adjacent users row.
 * One profile per user. Content encrypted as a single JSON blob.
 * Fields (inside encrypted blob): tendencies, goals, background.
 * Shape is two-way; evolves without migrations via the blob.
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

/**
 * Cabinet 2: narrative summary generated after each reflection.
 * encrypted_summary: AES-256-GCM ciphertext.
 * notable_quotes: encrypted JSON list of { quote, entry_id }.
 * generation_version: tracks prompt version so re-processed summaries are distinguishable.
 * Not surfaced to user in v1 — accumulates for v1.5 longitudinal features.
 */
export const reflectionSummaries = pgTable("reflection_summaries", {
  id: text("id").primaryKey(),
  reflectionId: text("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  encryptedSummary: text("encrypted_summary").notNull(),
  notableQuotes: text("notable_quotes").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  generationVersion: text("generation_version").notNull(),
});

/**
 * Layer 4: persistent user memory.
 * is_active: soft-delete flag (distinct from genuine full deletion).
 * last_confirmed_at: when the user last confirmed this memory is accurate.
 * Encrypted content; user has full view/edit/delete access (Phase 5).
 */
export const userMemory = pgTable("user_memory", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: memoryKindEnum("kind").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  source: memorySourceEnum("source").notNull(),
  reflectionId: text("reflection_id").references(() => reflections.id, {
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

/**
 * Safety classification log — for product owner to review tier-detection accuracy.
 * raw_signals: JSON of whatever signals triggered the classification.
 * reviewed: product owner has reviewed this entry.
 * reviewer_notes: product owner's calibration notes.
 */
export const safetyLog = pgTable("safety_log", {
  id: text("id").primaryKey(),
  reflectionId: text("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  entryId: text("entry_id").references(() => entries.id, {
    onDelete: "set null",
  }),
  tier: integer("tier").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  rawSignals: jsonb("raw_signals").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewed: boolean("reviewed").notNull().default(false),
  reviewerNotes: text("reviewer_notes"),
});

/**
 * Audit log for deliberate content decryption events.
 * Written whenever a user views decrypted reflection entries (reflection detail page).
 * context: human-readable label for the access point.
 */
export const contentAccessLog = pgTable("content_access_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reflectionId: text("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  accessedAt: timestamp("accessed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  context: text("context").notNull(),
});
