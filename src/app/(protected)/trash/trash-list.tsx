"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { TRASH_RETENTION_DAYS } from "@/lib/journal/retention";

export type TrashedEntry = {
  id: string;
  deletedAt: string;
  writtenAt: string;
  preview: string;
  daysLeft: number;
};

/**
 * Trash list with restore and permanent delete.
 *
 * Permanent delete uses inline confirmation rather than a toast — toasts report
 * after the fact, and this is the one action in the app with no undo. It says so
 * plainly rather than relying on the word "permanent" to carry the weight.
 *
 * ── Cards, but not `RecordCard` ───────────────────────────────────────────────
 * These get the same discrete-card positioning as every other list, drawn with
 * `Sheet` directly. They cannot use the shared component because each carries
 * buttons, and `RecordCard` is a link — nesting a button inside an anchor is
 * invalid and unusable with a keyboard. Rather than grow the shared card an
 * actions slot that only this screen would ever pass, the surface is shared and
 * the contents are not.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  empty: "[COPY] Nothing here.",
  emptyNote: (days: number) =>
    `[COPY] What you delete waits ${days} days before it is gone for good.`,
  emptyEntry: "[COPY] Empty entry",
  goesToday: "[COPY] Goes today",
  daysLeft: (n: number) => `[COPY] ${n} day${n === 1 ? "" : "s"} left`,
  restore: "[COPY] Put it back",
  confirmPrompt: "[COPY] Gone for good?",
  confirmYes: "[COPY] Yes, delete it",
  cancel: "[COPY] Cancel",
  deleteNow: "[COPY] Delete now",
  restoredToast: "[COPY] Put back",
  restoreError: "[COPY] Couldn't put that back",
  purgedToast: "[COPY] Deleted for good",
  purgeError: "[COPY] Couldn't delete that",
  footnote:
    "[COPY] That deletion is real — the text is destroyed, not hidden, and cannot be recovered afterwards.",
} as const;
export function TrashList({ entries }: { entries: TrashedEntry[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function restore(id: string) {
    setBusy(id);
    const res = await fetch(`/api/reflections/${id}/restore`, { method: "POST" });
    setBusy(null);
    setToast(res.ok ? COPY.restoredToast : COPY.restoreError);
    if (res.ok) router.refresh();
  }

  async function purge(id: string) {
    setBusy(id);
    const res = await fetch(`/api/reflections/${id}/purge`, { method: "DELETE" });
    setBusy(null);
    setConfirming(null);
    setToast(res.ok ? COPY.purgedToast : COPY.purgeError);
    if (res.ok) router.refresh();
  }

  const action = {
    fontFamily: "var(--font-mono)",
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  };

  if (entries.length === 0) {
    return (
      <Sheet className="px-8 py-14 text-center">
        <p
          style={{ fontSize: "14px", lineHeight: 1.9, color: "var(--rf-text-3)" }}
        >
          {COPY.empty}
          <br />
          {COPY.emptyNote(TRASH_RETENTION_DAYS)}
        </p>
      </Sheet>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-[10px]">
        {entries.map((e) => (
          <Sheet key={e.id} className="px-6 py-[15px]">
            <p
              className="line-clamp-2"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                lineHeight: 1.55,
                color: e.preview ? "var(--rf-text)" : "var(--rf-text-4)",
              }}
            >
              {e.preview || COPY.emptyEntry}
            </p>

            <div className="mt-[9px] flex flex-wrap items-center gap-x-4 gap-y-2">
              <Eyebrow size={9.5}>
                {new Date(e.writtenAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Eyebrow>

              {/* The only place a warmer colour is used, and only inside three
                  days of destruction. It states a deadline; it does not scold. */}
              <span
                className="font-mono uppercase"
                style={{
                  ...action,
                  color:
                    e.daysLeft <= 3 ? "var(--rf-warn)" : "var(--rf-text-4)",
                }}
              >
                {e.daysLeft <= 0 ? COPY.goesToday : COPY.daysLeft(e.daysLeft)}
              </span>

              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  onClick={() => restore(e.id)}
                  disabled={busy === e.id}
                  className="disabled:opacity-40"
                  style={{ ...action, color: "var(--rf-text-2)" }}
                >
                  {COPY.restore}
                </button>

                {confirming === e.id ? (
                  <>
                    <span style={{ ...action, color: "var(--rf-text-3)" }}>
                      {COPY.confirmPrompt}
                    </span>
                    <button
                      onClick={() => purge(e.id)}
                      disabled={busy === e.id}
                      className="disabled:opacity-40"
                      style={{ ...action, color: "var(--color-error)" }}
                    >
                      {COPY.confirmYes}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      style={{ ...action, color: "var(--rf-text-4)" }}
                    >
                      {COPY.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(e.id)}
                    style={{ ...action, color: "var(--rf-text-4)" }}
                  >
                    {COPY.deleteNow}
                  </button>
                )}
              </span>
            </div>
          </Sheet>
        ))}
      </div>

      <p
        className="mt-[14px] max-w-[520px]"
        style={{ fontSize: "11.5px", lineHeight: 1.6, color: "var(--rf-text-4)" }}
      >
        {COPY.footnote}
      </p>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
