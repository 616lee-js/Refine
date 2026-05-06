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

export const sessionTypeEnum = pgEnum("session_type", [
  "scheduled",
  "as_needed",
  "guided",
]);

export const sessionModalityEnum = pgEnum("session_modality", [
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
  "session_derived",
]);

// ── Tables ───────────────────────────────────────────────────────────────────

/**
 * v1 has exactly one user (the product owner).
 * user_id FK exists in all tables so v2 multi-user is additive (no schema change).
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  preferences: jsonb("preferences").notNull().default({}),
});

/**
 * Cabinet 1: each session is a container for entries.
 * scheduled_for: set when session was pre-scheduled; null for as-needed.
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: sessionTypeEnum("type").notNull(),
  modality: sessionModalityEnum("modality").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
});

/**
 * Structured check-in at session start.
 * mood: JSON object (shape defined per session type in Phase 3).
 * tier_at_start: initial safety tier assessed at session open.
 */
export const checkIns = pgTable("check_ins", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  mood: jsonb("mood").notNull().default({}),
  presentText: text("present_text"),
  tierAtStart: integer("tier_at_start"),
});

/**
 * Cabinet 1: individual message-level entries within a session.
 * encrypted_content: AES-256-GCM ciphertext (format: iv:tag:ciphertext, base64).
 * raw_audio_ref: local file path for voice entries; null for text.
 * tier_classification: safety tier of this message (null for claude entries).
 */
export const entries = pgTable("entries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  source: entrySourceEnum("source").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  rawAudioRef: text("raw_audio_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  tierClassification: integer("tier_classification"),
});

/**
 * Cabinet 2: narrative summary generated after each session.
 * encrypted_summary: AES-256-GCM ciphertext.
 * notable_quotes: encrypted JSON list of { quote, entry_id }.
 * generation_version: tracks prompt version so re-processed summaries are distinguishable.
 * Not surfaced to user in v1 — accumulates for v1.5 longitudinal features.
 */
export const sessionSummaries = pgTable("session_summaries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  encryptedSummary: text("encrypted_summary").notNull(),
  notableQuotes: text("notable_quotes").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
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
  sessionId: text("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  entryId: text("entry_id").references(() => entries.id, {
    onDelete: "set null",
  }),
  tier: integer("tier").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  rawSignals: jsonb("raw_signals").notNull().default({}),
  reviewed: boolean("reviewed").notNull().default(false),
  reviewerNotes: text("reviewer_notes"),
});
