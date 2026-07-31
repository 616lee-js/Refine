import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentAccessLog, journalEntries } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { PageBg } from "@/components/ui/page-bg";
import { Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { TrashList, type TrashedEntry } from "./trash-list";
import { TRASH_RETENTION_DAYS } from "@/lib/journal/retention";

/**
 * Trash.
 *
 * ── Why this page previews content when the archive refuses to ────────────────
 * The archive shows no excerpts, because decrypting a hundred entries to glance
 * at a list buries content_access_log in noise. Here the calculation is
 * different: the action on offer is permanent destruction, and recognising which
 * entry you are about to destroy is the whole point. A preview is worth its
 * decryption.
 *
 * It is still a decryption, so it is still logged — one row carrying the count,
 * the same shape Trends uses. It previously logged nothing at all.
 */

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  // Trashed but not yet purged. A purged row is a shell with no content — it
  // exists only so safety_log keeps its reference, and must never be listed.
  const rows = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, authSession.userId),
        isNotNull(journalEntries.deletedAt),
        isNull(journalEntries.purgedAt)
      )
    )
    .orderBy(desc(journalEntries.deletedAt));

  const now = Date.now();

  const entries: TrashedEntry[] = rows.map((r) => {
    let preview = "";
    if (r.encryptedBody) {
      try {
        // Preview only — enough to recognise which entry this is without
        // rendering the whole thing on a page about deleting it.
        preview = decrypt(r.encryptedBody).slice(0, 180);
      } catch {
        preview = "[could not be read]";
      }
    }

    const deletedAt = r.deletedAt!;
    const elapsedDays = Math.floor((now - deletedAt.getTime()) / 86_400_000);

    return {
      id: r.id,
      deletedAt: deletedAt.toISOString(),
      writtenAt: (r.completedAt ?? r.createdAt).toISOString(),
      preview,
      daysLeft: Math.max(0, TRASH_RETENTION_DAYS - elapsedDays),
    };
  });

  if (entries.length > 0) {
    await db.insert(contentAccessLog).values({
      id: randomUUID(),
      userId: authSession.userId,
      context: `trash_view (${entries.length} previews decrypted)`,
    });
  }

  return (
    <PageBg>
      <TopNav active="mirror" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 700 }}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-[14px]">
            <div>
              <Eyebrow>
                {entries.length} {entries.length === 1 ? "item" : "items"}
              </Eyebrow>
              <h1
                className="mt-[9px]"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "30px",
                  fontWeight: 380,
                  letterSpacing: "-0.02em",
                  color: "var(--rf-text)",
                }}
              >
                Trash
              </h1>
              <p
                className="mt-[8px] max-w-[440px]"
                style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
              >
                Kept for {TRASH_RETENTION_DAYS} days, then removed for good. You
                can put anything back before then.
              </p>
            </div>

            <Link
              href="/mirror"
              className="font-mono uppercase"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              ← Mirror
            </Link>
          </div>

          <TrashList entries={entries} />
        </div>
      </div>
    </PageBg>
  );
}
