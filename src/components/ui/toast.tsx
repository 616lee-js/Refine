"use client";

import { useEffect } from "react";

/**
 * Transient confirmation that something already happened.
 *
 * Never the only feedback: the view behind it should already reflect the change.
 * A toast carrying information available nowhere else is a bug — it disappears,
 * and fastest for whoever needs longest to read it.
 *
 * `role="status"` with `aria-live="polite"`, never `alert`: these confirm, they
 * do not interrupt.
 */
export function Toast({
  message,
  onDismiss,
  durationMs = 4000,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-stone-800 text-white text-sm px-4 py-2.5 shadow-lg"
    >
      {message}
    </div>
  );
}
