import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { journalEntries, contentAccessLog } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";
import { EntryTitle } from "./entry-title";

/**
 * Reading back a completed entry.
 *
 * Not editable here — editing happens on the writing surface at
 * /reflection/[id]. This page is for re-reading, at the same size the text was
 * written at, so that reading it back feels like the same object rather than a
 * summary of one.
 *
 * The exception is the title, which is editable in place. See ./entry-title.tsx
 * for why naming belongs to re-reading rather than to finishing.
 */
export default async function ReflectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authSession = await getSession();
  if (!authSession.userId) notFound();

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, authSession.userId)
      )
    )
    .limit(1);

  // Ownership is enforced in the query, so a miss is either "not yours" or
  // "doesn't exist" — both 404, which avoids confirming that an id exists.
  if (!entry) notFound();

  // A purged entry has no content to show. Its row only exists so the safety
  // log keeps its reference.
  if (entry.purgedAt) notFound();

  // Audit: this is a deliberate decryption event.
  await db.insert(contentAccessLog).values({
    id: randomUUID(),
    userId: authSession.userId,
    journalEntryId: id,
    context: "journal_entry_detail_view",
  });

  let body = "";
  let decryptFailed = false;
  if (entry.encryptedBody) {
    try {
      body = decrypt(entry.encryptedBody);
    } catch (err) {
      decryptFailed = true;
      console.error(
        `Journal entry decrypt failed for ${id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  let title: string | null = null;
  if (entry.encryptedTitle) {
    try {
      title = decrypt(entry.encryptedTitle);
    } catch {
      title = null;
    }
  }

  const written = entry.completedAt ?? entry.createdAt;
  const dateLong = written.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <PageBg>
      <TopNav active="reflections" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 700 }}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-[14px]">
            <div className="min-w-0">
              <Eyebrow>
                {dateLong}
                {" · "}
                {written.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {!entry.completedAt && " · unfinished"}
              </Eyebrow>
              <div className="mt-[9px]">
                <EntryTitle
                  entryId={entry.id}
                  initialTitle={title}
                  fallback={dateLong}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {words > 0 && !decryptFailed && (
                <Eyebrow size={9.5}>{words} words</Eyebrow>
              )}
              <Link
                href={`/reflection/${entry.id}`}
                className="rounded-full transition-colors"
                style={{
                  padding: "7px 14px",
                  fontSize: "12.5px",
                  color: "var(--rf-text-2)",
                  boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
                }}
              >
                Add to this
              </Link>
            </div>
          </div>

          <Sheet className="px-9 py-9 sm:px-12 sm:py-11">
            {decryptFailed ? (
              <p
                className="rounded-[10px] px-5 py-4"
                style={{
                  fontSize: "13.5px",
                  lineHeight: 1.7,
                  color: "var(--color-error)",
                  background: "rgba(163, 58, 37, 0.08)",
                }}
              >
                This entry could not be read. Its content is still stored, but the
                encryption key does not match — nothing has been lost, and it
                should not be edited or overwritten until that is resolved.
              </p>
            ) : body ? (
              <article
                className="whitespace-pre-wrap"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-entry)",
                  lineHeight: 1.75,
                  color: "var(--rf-text)",
                }}
              >
                {body}
              </article>
            ) : (
              <p style={{ fontSize: "14px", color: "var(--rf-text-4)" }}>
                This one is empty.
              </p>
            )}
          </Sheet>

          <div className="pt-[14px]">
            <Link
              href="/reflections"
              className="font-mono uppercase transition-colors"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              ← Everything you&apos;ve written
            </Link>
          </div>
        </div>
      </div>
    </PageBg>
  );
}
