"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * "Admin settings" — one item in the top nav that opens a menu of the admin
 * screens. Owner's wording and owner's request, 2026-11-11: the five links used
 * to sit in the nav as a row of pills.
 *
 * Opens on hover and on click (so a touch screen, which has no hover, taps it);
 * closes on a click outside, on Escape, and when the pointer leaves. Rendered
 * only by AdminNav, which has already checked the session — this component
 * grants nothing and is never mounted for a non-admin.
 */
export function AdminMenu({
  links,
  active,
}: {
  links: { href: string; label: string }[];
  /** True on an admin page: the trigger is filled rather than outlined. */
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-[7px] rounded-full transition-colors"
        style={{
          padding: "4px 11px 4px 9px",
          fontSize: "12.5px",
          // Deliberately not the accent: admin context must not read as part of
          // the reflective surface. See admin-nav.tsx.
          color: active ? "var(--rf-paper)" : "var(--rf-admin)",
          background: active ? "var(--rf-admin)" : "var(--rf-admin-soft)",
          boxShadow: active ? "none" : "inset 0 0 0 1px var(--rf-admin-border)",
        }}
      >
        Admin settings
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          fill="currentColor"
          aria-hidden="true"
          className="transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M1 3 L5 8 L9 3 Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 flex min-w-[160px] flex-col rounded-[6px] py-1"
          style={{
            background: "var(--rf-paper)",
            boxShadow:
              "inset 0 0 0 1px var(--rf-admin-border), 0 6px 20px rgba(0,0,0,0.08)",
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="px-3 py-[7px] transition-colors hover:opacity-70"
              style={{ fontSize: "12.5px", color: "var(--rf-admin)" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
