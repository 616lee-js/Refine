"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * "It saved." Shown once, on arrival from the writing surface.
 *
 * ── Inline, not a toast ───────────────────────────────────────────────────────
 * A toast is fine for confirming something the page already shows. Arriving on
 * a different page is the one moment the person cannot see what changed — they
 * just left the editor — so the confirmation has to be readable for as long as
 * they need it, not for four seconds.
 *
 * ── Arrival only ──────────────────────────────────────────────────────────────
 * The trigger is a query parameter (`?completed=1` / `?saved=1`), stripped on
 * mount with `history.replaceState` rather than `router.replace`: the latter
 * refetches the page, which would decrypt the entry again and write a second
 * audit row for a read that did not happen. A reload after that shows the plain
 * read view, which is right — the confirmation belongs to the act, not the page.
 */

// COPY REVIEW: placeholders pending final wording.
const COPY = {
  completed: "[COPY] Entry completed",
  saved: "[COPY] Changes saved",
} as const;

export function CompletionNotice({ kind }: { kind: "completed" | "saved" }) {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", pathname);
    }
  }, [pathname]);

  return (
    <p
      role="status"
      aria-live="polite"
      className="mb-[14px] inline-flex items-center gap-2 rounded-full"
      style={{
        padding: "6px 12px 6px 10px",
        fontSize: "12.5px",
        color: "var(--rf-accent-2)",
        background: "var(--rf-accent-2-soft)",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 6.5 L5 9 L9.5 3.5" />
      </svg>
      {kind === "completed" ? COPY.completed : COPY.saved}
    </p>
  );
}
