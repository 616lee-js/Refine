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
      // bottom-24 below `sm`: the feedback widget is anchored bottom-right, and a
      // centred toast is wide enough at 375px to run underneath it. Above `sm`
      // there is horizontal room and it sits where it always did.
      className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full max-w-[calc(100vw-2rem)]"
      // An ink pill on paper, rather than the stone-800 card it was. The fill
      // is --rf-text so it inverts with the palette: in dark it becomes pale
      // type on a light pill, which is the same relationship, not the same
      // colours. The shadow is the sheet's, so it sits in the same light as
      // every other raised surface.
      style={{
        padding: "9px 16px",
        fontSize: "13px",
        background: "var(--rf-text)",
        color: "var(--rf-paper)",
        boxShadow: "var(--rf-sheet-shadow)",
      }}
    >
      {message}
    </div>
  );
}
