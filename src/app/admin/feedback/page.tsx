import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { pageLabel } from "@/lib/feedback/pages";

/**
 * Bug reports and requests, newest first.
 *
 * Shell — top nav, background, admin context bar — comes from
 * src/app/admin/layout.tsx, so this page is not a dead end and renders only its
 * own content.
 *
 * Submissions carry no user identifier by design; see the `feedback` table
 * comment in src/lib/db/schema.ts, including why "unattributed" is not the same
 * as "anonymous".
 */

// requireAdmin() calls getSession() -> cookies(), which already forces dynamic
// rendering — but stated explicitly so protection never depends on that as a
// side effect. A statically prerendered admin page would run its authorisation
// once at build time rather than per visitor.
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  bug: "Bug",
  request: "Request",
};

/**
 * Flips one submission between new and completed.
 *
 * Gated separately from the page. A server action is an independently
 * addressable endpoint — it does not render through the page or the layout, so
 * neither of their checks protects it.
 */
async function toggleStatus(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = formData.get("id");
  const next = formData.get("next");
  if (typeof id !== "string") return;
  if (next !== "new" && next !== "completed") return;

  await db.update(feedback).set({ status: next }).where(eq(feedback.id, id));
  revalidatePath("/admin/feedback");
}

function Row({
  row,
}: {
  row: {
    id: string;
    type: string;
    body: string;
    status: string;
    createdAt: Date;
    page: string | null;
  };
}) {
  const done = row.status === "completed";
  return (
    <Sheet className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span
            className="rounded-full font-mono uppercase"
            style={{
              padding: "3px 8px",
              fontSize: "9px",
              letterSpacing: "0.14em",
              color: row.type === "bug" ? "var(--color-error)" : "var(--rf-accent-2)",
              background:
                row.type === "bug"
                  ? "rgba(163, 58, 37, 0.08)"
                  : "var(--rf-accent-2-soft)",
            }}
          >
            {TYPE_LABEL[row.type] ?? row.type}
          </span>
          <Eyebrow size={9.5}>
            {row.createdAt.toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Eyebrow>
          {/* Where it was sent from. A route pattern, never a concrete path —
              see src/lib/feedback/pages.ts for why the id is stripped. */}
          <span
            className="rounded-full"
            style={{
              padding: "3px 8px",
              fontSize: "10.5px",
              color: row.page ? "var(--rf-text-2)" : "var(--rf-text-4)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          >
            {pageLabel(row.page)}
          </span>
        </div>

        <form action={toggleStatus}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="next" value={done ? "new" : "completed"} />
          <button
            type="submit"
            className="rounded-full transition-colors"
            style={{
              padding: "5px 12px",
              fontSize: "11.5px",
              color: done ? "var(--rf-text-3)" : "var(--rf-paper)",
              background: done ? "transparent" : "var(--rf-text)",
              boxShadow: done ? "inset 0 0 0 1px var(--rf-border-strong)" : "none",
            }}
          >
            {done ? "Reopen" : "Mark completed"}
          </button>
        </form>
      </div>

      <p
        className="mt-3 whitespace-pre-wrap"
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: "var(--rf-text)",
        }}
      >
        {row.body}
      </p>
    </Sheet>
  );
}

function Section({
  title,
  rows,
  openByDefault,
}: {
  title: string;
  rows: Parameters<typeof Row>[0]["row"][];
  openByDefault: boolean;
}) {
  return (
    // Native <details>: keyboard operation, screen-reader semantics and the
    // open/closed state all come free, and it needs no client component.
    <details open={openByDefault} className="mb-6">
      <summary
        className="cursor-pointer list-none py-2"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "19px",
            color: "var(--rf-text)",
          }}
        >
          {title}
        </span>{" "}
        <span
          className="font-mono"
          style={{ fontSize: "11px", color: "var(--rf-text-4)" }}
        >
          ({rows.length})
        </span>
      </summary>

      <div className="mt-2 flex flex-col gap-3">
        {rows.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
            Nothing here.
          </p>
        ) : (
          rows.map((r) => <Row key={r.id} row={r} />)
        )}
      </div>
    </details>
  );
}

export default async function AdminFeedbackPage() {
  // Gate BEFORE any query runs.
  await requireAdmin();

  const rows = await db
    .select()
    .from(feedback)
    .orderBy(desc(feedback.createdAt));

  const fresh = rows.filter((r) => r.status === "new");
  const done = rows.filter((r) => r.status === "completed");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
      <div className="mb-6">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "27px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
          }}
        >
          Feedback
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
        >
          {rows.length} {rows.length === 1 ? "submission" : "submissions"}.
          Submitted without an account attached.
        </p>
      </div>

      <Section title="New" rows={fresh} openByDefault />
      <Section title="Completed" rows={done} openByDefault={false} />
    </main>
  );
}
