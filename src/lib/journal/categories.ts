import "server-only";
import { randomUUID } from "crypto";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  entryCategories,
  journalEntries,
  journalEntryCategories,
} from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * The person's own categories for their entries.
 *
 * ── Theirs, not the app's ─────────────────────────────────────────────────────
 * Refine neither suggests nor assigns a category. Until 2026-11-11 the
 * summariser sorted every entry into one of nine fixed buckets, and that was
 * what the archive filtered on; the owner's decision was that a category is how
 * a person finds their own writing again, so it has to be a word they chose.
 * The summariser still records what an entry is about — in the writer's own
 * words, as `topics` — but that is a description, not a filing system.
 *
 * ── Names are content ─────────────────────────────────────────────────────────
 * A category name is the person's words about their own writing, so it is
 * encrypted like a title. Every read here decrypts; callers count the names
 * they read into their `content_access_log` row, the same rule as everywhere
 * else. Nothing in this module writes that log itself, because a page usually
 * has one row to write and this would be a second.
 *
 * ── Why the lookups are small ─────────────────────────────────────────────────
 * One person's list is tens of names, not thousands. Matching "does this name
 * exist already" after decrypting the whole list is fine at that size, and
 * SQL could not do it on ciphertext anyway.
 */

export type Category = { id: string; name: string };
export type CategoryWithCount = Category & { count: number };

export const MAX_CATEGORY_NAME_CHARS = 40;

/** Collapsed whitespace, trimmed, bounded. Null when there is nothing usable. */
export function cleanCategoryName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > MAX_CATEGORY_NAME_CHARS) return null;
  return name;
}

const fold = (name: string) => name.toLowerCase();

/** The person's categories, decrypted. Unreadable names are left out, not blanked. */
async function readAll(userId: string): Promise<Category[]> {
  const rows = await db
    .select({ id: entryCategories.id, encryptedName: entryCategories.encryptedName })
    .from(entryCategories)
    .where(eq(entryCategories.userId, userId));

  const out: Category[] = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, name: decrypt(r.encryptedName) });
    } catch (err) {
      console.error(
        `Category decrypt failed for ${r.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return out;
}

/**
 * Every category, with how many of the person's live entries carry it.
 * Most-used first, then by name, so the filter offers the useful ones first.
 */
export async function listCategories(userId: string): Promise<CategoryWithCount[]> {
  const [all, counts] = await Promise.all([
    readAll(userId),
    db
      .select({ categoryId: journalEntryCategories.categoryId, n: count() })
      .from(journalEntryCategories)
      .innerJoin(
        journalEntries,
        eq(journalEntries.id, journalEntryCategories.journalEntryId)
      )
      .where(
        and(
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
          isNull(journalEntries.purgedAt)
        )
      )
      .groupBy(journalEntryCategories.categoryId),
  ]);

  const byId = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
  return all
    .map((c) => ({ ...c, count: byId.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The categories on each of the given entries. Entries with none are absent. */
export async function categoriesForEntries(
  userId: string,
  entryIds: string[]
): Promise<Map<string, Category[]>> {
  const out = new Map<string, Category[]>();
  if (entryIds.length === 0) return out;

  const [all, links] = await Promise.all([
    readAll(userId),
    db
      .select({
        entryId: journalEntryCategories.journalEntryId,
        categoryId: journalEntryCategories.categoryId,
      })
      .from(journalEntryCategories)
      .where(inArray(journalEntryCategories.journalEntryId, entryIds)),
  ]);

  const byId = new Map(all.map((c) => [c.id, c]));
  for (const l of links) {
    const c = byId.get(l.categoryId);
    if (!c) continue; // another person's category id, or unreadable — never shown
    const list = out.get(l.entryId) ?? [];
    list.push(c);
    out.set(l.entryId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** The category with this name, matched without regard to case, or null. */
export async function findCategory(userId: string, name: string): Promise<Category | null> {
  const all = await readAll(userId);
  return all.find((c) => fold(c.name) === fold(name)) ?? null;
}

/**
 * Creates a category, or returns the one that already has this name.
 *
 * Case-insensitive on purpose: "Work" and "work" as two categories is the
 * exact mess a category list exists to prevent.
 */
export async function createCategory(userId: string, name: string): Promise<Category> {
  const existing = await findCategory(userId, name);
  if (existing) return existing;

  const id = randomUUID();
  const now = new Date();
  await db.insert(entryCategories).values({
    id,
    userId,
    encryptedName: encrypt(name),
    createdAt: now,
    updatedAt: now,
  });
  return { id, name };
}

/** Renames one of the person's categories. False when it is not theirs. */
export async function renameCategory(
  userId: string,
  id: string,
  name: string
): Promise<boolean> {
  const result = await db
    .update(entryCategories)
    .set({ encryptedName: encrypt(name), updatedAt: new Date() })
    .where(and(eq(entryCategories.id, id), eq(entryCategories.userId, userId)))
    .returning({ id: entryCategories.id });
  return result.length > 0;
}

/**
 * Deletes a category outright. Every entry that carried it simply stops
 * carrying it (the link rows cascade); the entries themselves are untouched.
 */
export async function deleteCategory(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(entryCategories)
    .where(and(eq(entryCategories.id, id), eq(entryCategories.userId, userId)))
    .returning({ id: entryCategories.id });
  return result.length > 0;
}

/**
 * Replaces the set of categories on an entry.
 *
 * The caller has already checked the entry is theirs. Category ids that are
 * not theirs are dropped rather than refused — a stale id from another tab is
 * not worth failing the whole save over.
 */
export async function setEntryCategories(
  userId: string,
  entryId: string,
  categoryIds: string[]
): Promise<void> {
  const wanted = [...new Set(categoryIds)];
  const owned = wanted.length
    ? await db
        .select({ id: entryCategories.id })
        .from(entryCategories)
        .where(
          and(eq(entryCategories.userId, userId), inArray(entryCategories.id, wanted))
        )
    : [];
  const keep = owned.map((r) => r.id);

  await db.transaction(async (tx) => {
    await tx
      .delete(journalEntryCategories)
      .where(eq(journalEntryCategories.journalEntryId, entryId));
    if (keep.length) {
      await tx.insert(journalEntryCategories).values(
        keep.map((categoryId) => ({ journalEntryId: entryId, categoryId }))
      );
    }
  });
}
