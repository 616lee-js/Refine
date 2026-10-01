import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import {
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthSheet,
  AuthShell,
  AuthSubmit,
  Wordmark,
} from "../auth-ui";

/**
 * Setting a new password with a code.
 *
 * ── Why there is no "email me a link" ─────────────────────────────────────────
 * The app cannot send email — no mail dependency, no SMTP settings, no sending
 * domain. A code is issued by an admin and handed over the way invite codes
 * already are. The screen says so plainly rather than leaving someone waiting for
 * a message that is never coming, which is the one failure this page exists to
 * avoid.
 *
 * ── One error for everything ──────────────────────────────────────────────────
 * Unknown address, wrong code, expired, revoked, already spent — all the same
 * message. Distinguishing them would tell whoever is typing which addresses have
 * accounts. A too-short password and a locked address are separable, because
 * neither reveals whether the account exists.
 */

// COPY REVIEW: all of it — headings, labels, instructions and errors. The
// explanation of *why* there is a code rather than a link is not decoration: it is
// the only thing stopping someone waiting for an email.
const COPY = {
  wordmark: "[COPY] Refine",
  lede: "[COPY] Set a new password",
  intro:
    "[COPY] Refine cannot send email, so password resets are not automatic. Ask for a reset code, then enter it here with the password you want.",

  emailLabel: "[COPY] Email address",
  emailPlaceholder: "[COPY] The address on your account",
  codeLabel: "[COPY] Reset code",
  codePlaceholder: "[COPY] XXXX-XXXX-XXXX",
  passwordLabel: "[COPY] New password",
  passwordPlaceholder: (n: number) => `[COPY] At least ${n} characters`,

  submit: "[COPY] Set new password",

  errors: {
    invalid:
      "[COPY] That email and code do not go together, or the code has expired or already been used. Ask for a new one.",
    weak: (n: number) => `[COPY] Pick a password of at least ${n} characters.`,
    locked:
      "[COPY] Too many attempts. Wait a few minutes and try again — nothing has changed on your account.",
    missing: "[COPY] Fill in all three boxes.",
  },

  done: "[COPY] Your password is set. Sign in with it.",

  backToSignIn: "[COPY] Remembered it?",
  signIn: "[COPY] Sign in",
} as const;

function errorFor(code: string | undefined): string | null {
  switch (code) {
    case "invalid":
      return COPY.errors.invalid;
    case "weak":
      return COPY.errors.weak(MIN_PASSWORD_LENGTH);
    case "locked":
      return COPY.errors.locked;
    case "missing":
      return COPY.errors.missing;
    default:
      return null;
  }
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const message = errorFor(error);

  return (
    <AuthShell>
      <Wordmark>{COPY.wordmark}</Wordmark>

      <AuthSheet>
        <AuthHeading>{COPY.lede}</AuthHeading>

        {done ? (
          <div className="mt-4">
            {/* `quiet`, not a success colour — Notice has error, warn and quiet,
                and this is a statement of fact rather than a congratulation. */}
            <Notice tone="quiet">{COPY.done}</Notice>
          </div>
        ) : (
          <>
            <p
              className="mt-3"
              style={{
                fontSize: "12.5px",
                lineHeight: 1.6,
                color: "var(--rf-text-3)",
              }}
            >
              {COPY.intro}
            </p>

            <form
              action="/api/auth/reset"
              method="POST"
              className="mt-4 flex flex-col gap-[14px]"
            >
              <AuthField
                id="email"
                name="email"
                type="email"
                label={COPY.emailLabel}
                placeholder={COPY.emailPlaceholder}
                autoComplete="email"
                autoFocus
              />
              <AuthField
                id="code"
                name="code"
                type="text"
                label={COPY.codeLabel}
                placeholder={COPY.codePlaceholder}
                autoComplete="one-time-code"
              />
              <AuthField
                id="password"
                name="password"
                type="password"
                label={COPY.passwordLabel}
                placeholder={COPY.passwordPlaceholder(MIN_PASSWORD_LENGTH)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />

              {message && <Notice tone="error">{message}</Notice>}

              <div className="mt-1">
                <AuthSubmit>{COPY.submit}</AuthSubmit>
              </div>
            </form>
          </>
        )}
      </AuthSheet>

      <AuthFooter>
        {COPY.backToSignIn}{" "}
        <Link
          href="/login"
          style={{
            color: "var(--rf-text-2)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {COPY.signIn}
        </Link>
      </AuthFooter>
    </AuthShell>
  );
}
