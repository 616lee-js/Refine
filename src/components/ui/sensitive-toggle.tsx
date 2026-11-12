"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Marks an entry sensitive, or unmarks it. On the entry's header.
 *
 * What the flag does is stated under the button rather than in a tooltip,
 * because it decides what Mirror and Trends are allowed to read, and that is
 * not something to discover afterwards. Owner's decision, 2026-11-11: no PIN
 * this round, flag and unflag freely.
 */

// COPY REVIEW: the sensitive control, in full.
const COPY = {
  mark: "[COPY] Mark sensitive",
  unmark: "[COPY] Sensitive · unmark",
  note: "[COPY] A sensitive entry stays yours to read and edit, and is kept out of Mirror reports, Threads and Trends.",
  error: "[COPY] That didn't save — try again.",
} as const;

export function SensitiveToggle({
  entryId,
  initial,
}: {
  entryId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/reflections/${entryId}/sensitive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensitive: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setOn(!next);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={on}
        className="rounded-full transition-colors disabled:opacity-60"
        style={{
          padding: "7px 14px",
          fontSize: "12.5px",
          color: on ? "var(--rf-paper)" : "var(--rf-text-2)",
          background: on ? "var(--rf-text)" : "transparent",
          boxShadow: on ? "none" : "inset 0 0 0 1px var(--rf-border-strong)",
        }}
      >
        {on ? COPY.unmark : COPY.mark}
      </button>
      {on && (
        <p
          className="max-w-[260px] text-right"
          style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--rf-text-4)" }}
        >
          {COPY.note}
        </p>
      )}
      {failed && (
        <p aria-live="polite" style={{ fontSize: "11.5px", color: "var(--color-error)" }}>
          {COPY.error}
        </p>
      )}
    </div>
  );
}
