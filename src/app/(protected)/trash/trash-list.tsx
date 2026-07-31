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
 */
export function TrashList({ entries }: { entries: TrashedEntry[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function restore(id: string) {
    setBusy(id);
    const res = await fetch(`/api/reflections/${id}/restore`, { method: "POST" });
    setBusy(null);
    setToast(res.ok ? "Put back" : "Couldn't put that back");
    if (res.ok) router.refresh();
  }

  async function purge(id: string) {
    setBusy(id);
    const res = await fetch(`/api/reflections/${id}/purge`, { method: "DELETE" });
    setBusy(null);
    setConfirming(null);
    setToast(res.ok ? "Deleted for good" : "Couldn't delete that");
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
          Nothing here.
          <br />
          What you delete waits {TRASH_RETENTION_DAYS} days before it is gone for
          good.
        </p>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet className="px-7 pb-5 pt-1">
        {entries.map((e, i) => (
          <div
            key={e.id}
            className="py-[15px]"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--rf-rule)" }}
          >
            <p
              className="line-clamp-2"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                lineHeight: 1.55,
                color: e.preview ? "var(--rf-text)" : "var(--rf-text-4)",
              }}
            >
              {e.preview || "Empty entry"}
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
                {e.daysLeft <= 0
                  ? "Goes today"
                  : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left`}
              </span>

              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  onClick={() => restore(e.id)}
                  disabled={busy === e.id}
                  className="disabled:opacity-40"
                  style={{ ...action, color: "var(--rf-text-2)" }}
                >
                  Put it back
                </button>

                {confirming === e.id ? (
                  <>
                    <span style={{ ...action, color: "var(--rf-text-3)" }}>
                      Gone for good?
                    </span>
                    <button
                      onClick={() => purge(e.id)}
                      disabled={busy === e.id}
                      className="disabled:opacity-40"
                      style={{ ...action, color: "var(--color-error)" }}
                    >
                      Yes, delete it
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      style={{ ...action, color: "var(--rf-text-4)" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(e.id)}
                    style={{ ...action, color: "var(--rf-text-4)" }}
                  >
                    Delete now
                  </button>
                )}
              </span>
            </div>
          </div>
        ))}
      </Sheet>

      <p
        className="mt-[14px] max-w-[520px]"
        style={{ fontSize: "11.5px", lineHeight: 1.6, color: "var(--rf-text-4)" }}
      >
        That deletion is real — the text is destroyed, not hidden, and cannot be
        recovered afterwards.
      </p>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
