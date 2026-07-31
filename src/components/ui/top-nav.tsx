import Link from "next/link";

/**
 * Shared top navigation.
 *
 * Vocabulary is the repo's, not the design's: **Reflections**, not "Entries".
 * "Journal entry" stays the data noun; "reflection" is the practice and the
 * user-facing word.
 */
export type NavKey = "today" | "reflections" | "mirror" | "profile";

export function Wordmark() {
  return (
    <Link
      href="/"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "19px",
        fontWeight: 400,
        letterSpacing: "-0.01em",
        color: "var(--rf-text)",
      }}
    >
      Refine<span style={{ color: "var(--rf-accent)" }}>.</span>
    </Link>
  );
}

export function TopNav({
  active,
  admin,
  children,
}: {
  active?: NavKey;
  /**
   * The admin entry points, as a rendered server component — see
   * components/ui/admin-nav.tsx. Omitted means no admin link, which is the safe
   * direction: TopNav cannot check for itself because it renders inside client
   * components on several screens.
   */
  admin?: React.ReactNode;
  /** Optional extra controls, rendered before the nav links. */
  children?: React.ReactNode;
}) {
  const item = (href: string, label: string, key: NavKey) => {
    const on = active === key;
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className="transition-colors hover:!text-[var(--rf-text)]"
        style={{
          fontSize: "13.5px",
          fontWeight: on ? 500 : 400,
          color: on ? "var(--rf-text)" : "var(--rf-text-3)",
          paddingBottom: "2px",
          borderBottom: on
            ? "1px solid var(--rf-accent)"
            : "1px solid transparent",
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-6 px-6 py-4 sm:px-10"
      style={{ borderBottom: "1px solid var(--rf-border)" }}
    >
      <Wordmark />

      <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:gap-x-6">
        {admin}
        {children}
        {item("/reflections", "Reflections", "reflections")}
        {item("/mirror", "Mirror", "mirror")}
        {item("/settings/profile", "Profile", "profile")}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="transition-colors hover:!text-[var(--rf-text)]"
            style={{ fontSize: "13.5px", color: "var(--rf-text-3)" }}
          >
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
