"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/toast";

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
    await fetch(`/api/reflections/${id}/restore`, { method: "POST" });
    setBusy(null);
    setToast("Entry restored");
    router.refresh();
  }

  async function purge(id: string) {
    setBusy(id);
    await fetch(`/api/reflections/${id}/purge`, { method: "DELETE" });
    setBusy(null);
    setConfirming(null);
    setToast("Entry permanently deleted");
    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <div className="pt-16 text-center">
        <p className="text-sm text-stone-400 leading-loose">
          Nothing in the trash.
          <br />
          Deleted entries wait here for 30 days before they&apos;re gone for good.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-stone-400 mb-6 leading-relaxed">
        Entries here are deleted permanently 30 days after you remove them. That
        deletion is real — the text is destroyed, not hidden, and cannot be
        recovered afterwards.
      </p>

      <ol className="divide-y divide-stone-100">
        {entries.map((e) => (
          <li key={e.id} className="py-4 space-y-2">
            <p className="text-sm text-stone-700 leading-relaxed line-clamp-2">
              {e.preview || <span className="text-stone-400">Empty entry</span>}
            </p>

            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="text-stone-400">
                {new Date(e.writtenAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-stone-200">·</span>
              <span className={e.daysLeft <= 3 ? "text-amber-700" : "text-stone-400"}>
                {e.daysLeft <= 0
                  ? "Deleting today"
                  : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left`}
              </span>
              <span className="text-stone-200">·</span>

              <button
                onClick={() => restore(e.id)}
                disabled={busy === e.id}
                className="text-stone-500 hover:text-stone-700 disabled:opacity-40 transition-colors"
              >
                Restore
              </button>

              {confirming === e.id ? (
                <>
                  <span className="text-stone-500">Delete forever?</span>
                  <button
                    onClick={() => purge(e.id)}
                    disabled={busy === e.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors"
                  >
                    Yes, delete permanently
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirming(e.id)}
                  className="text-stone-400 hover:text-red-600 transition-colors"
                >
                  Delete permanently
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
