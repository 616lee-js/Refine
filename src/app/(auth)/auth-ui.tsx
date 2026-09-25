import { type ReactNode } from "react";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet } from "@/components/ui/sheet";

/**
 * The shell and the field shared by sign in and sign up.
 *
 * ── Why the two screens share this ────────────────────────────────────────────
 * They were near-identical copies that had already drifted: the same input
 * markup repeated six times across two files, with the invite field carrying an
 * extra hundred characters of class names nobody could diff by eye.
 *
 * ── Visible labels, not sr-only ───────────────────────────────────────────────
 * Both screens hid their labels and leaned on the placeholder to say what a
 * field was. A placeholder disappears the moment you type, so anyone
 * interrupted mid-form came back to boxes with no names on them — and for
 * "Display name" versus "Email", that matters. The label is now on the page.
 *
 * ── Appearance is fixed here ──────────────────────────────────────────────────
 * These screens are always Dawn, light. Someone who has chosen Dusk still signs
 * in on warm paper, because a signed-out page has no account to read a
 * preference from and guessing one from a cookie would mean the sign-in screen
 * changed colour for reasons the person cannot see.
 */

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PageBg>
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full" style={{ maxWidth: 380 }}>
          {children}
        </div>
      </main>
    </PageBg>
  );
}

export function AuthSheet({ children }: { children: ReactNode }) {
  return (
    <Sheet className="mt-[22px]" style={{ padding: "28px 30px 30px" }}>
      {children}
    </Sheet>
  );
}

export function Wordmark({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "28px",
        fontWeight: 400,
        letterSpacing: "-0.01em",
        color: "var(--rf-text)",
      }}
    >
      {children}
    </p>
  );
}

export function AuthHeading({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "25px",
        fontWeight: 380,
        letterSpacing: "-0.02em",
        color: "var(--rf-text)",
      }}
    >
      {children}
    </h1>
  );
}

/**
 * One labelled field.
 *
 * Every attribute that decides behaviour — the name the form posts under,
 * autocomplete, required, minLength — is passed through untouched. Only the
 * appearance is this component's business.
 */
export function AuthField({
  id,
  name,
  label,
  placeholder,
  type = "text",
  mono = false,
  autoComplete,
  autoFocus,
  minLength,
  autoCapitalize,
  spellCheck,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  /** The invite code, which is a machine string rather than prose. */
  mono?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
  autoCapitalize?: string;
  spellCheck?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-[6px]"
        style={{ fontSize: "12.5px", color: "var(--rf-text-2)" }}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        className={`rf-input ${mono ? "rf-input-mono" : ""}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        minLength={minLength}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
      />
    </div>
  );
}

export function AuthSubmit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-full transition-colors"
      style={{
        padding: "11px 18px",
        fontSize: "13.5px",
        fontWeight: 500,
        background: "var(--rf-text)",
        color: "var(--rf-paper)",
      }}
    >
      {children}
    </button>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-5 text-center"
      style={{ fontSize: "13px", color: "var(--rf-text-3)" }}
    >
      {children}
    </p>
  );
}
