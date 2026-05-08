import { type ReactNode } from "react";

export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-xs font-semibold text-stone-400 uppercase tracking-widest ${className}`}
    >
      {children}
    </h2>
  );
}
