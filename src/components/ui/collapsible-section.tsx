import { type ReactNode } from "react";

/**
 * A titled section that opens and closes.
 *
 * ── Native `<details>`, as everywhere else in the app ─────────────────────────
 * Keyboard operation, screen-reader semantics and the open state all come free,
 * and it needs no client component. The marker turns off the browser's own open
 * state via `group-open`, so there is no JavaScript behind it either.
 *
 * ── The marker is not decoration ──────────────────────────────────────────────
 * The design system's rule: a collapsible section needs a marker that turns,
 * because plain text does not read as something that opens. Same triangle as the
 * archive's filter section, so the two behave alike.
 */
export function CollapsibleSection({
  title,
  note,
  defaultOpen = true,
  right,
  children,
  className = "",
}: {
  title: string;
  /** One line under the title. Optional. */
  note?: string;
  defaultOpen?: boolean;
  /** Shown at the end of the title row — a status line, a count. */
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group ${className}`}>
      <summary
        className="flex cursor-pointer list-none items-center gap-[7px] py-1"
        style={{ color: "var(--rf-text)" }}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          fill="currentColor"
          className="shrink-0 transition-transform group-open:rotate-90"
          style={{ color: "var(--rf-text-3)" }}
          aria-hidden="true"
        >
          <path d="M3 1 L8 5 L3 9 Z" />
        </svg>

        <h2
          className="font-mono uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "0.18em",
            fontWeight: 500,
            color: "var(--rf-text-3)",
          }}
        >
          {title}
        </h2>

        {right && <span className="ml-auto">{right}</span>}
      </summary>

      {note && (
        <p
          className="mb-3 mt-[6px] max-w-[460px]"
          style={{ fontSize: "12.5px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
        >
          {note}
        </p>
      )}

      <div className={note ? "" : "mt-3"}>{children}</div>
    </details>
  );
}
