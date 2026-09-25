import { type ReactNode } from "react";
import { Eyebrow } from "./sheet";

/**
 * A section heading.
 *
 * ── Why it wraps Eyebrow rather than restating it ─────────────────────────────
 * It used to draw its own `text-stone-400 font-semibold uppercase`, which was a
 * near-copy of `Eyebrow` in a different grey, a different weight and a different
 * tracking. Two components meant the same thing and did not look the same.
 *
 * Now there is one small-caps treatment in the app and this adds the only thing
 * it was ever really for: the `<h2>`, so a section is a landmark a screen reader
 * can jump to rather than styled text.
 */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={className}>
      <Eyebrow>{children}</Eyebrow>
    </h2>
  );
}
