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

// COPY REVIEW: all of it — headings, labels, placeholders and every error.
const COPY = {
  wordmark: "[COPY] Refine",
  lede: "[COPY] Create your account",
  inviteNote: "[COPY] Refine is invite-only while it's in testing.",

  inviteLabel: "[COPY] Invite code",
  invitePlaceholder: "[COPY] Invite code",
  nameLabel: "[COPY] Display name",
  namePlaceholder: "[COPY] Display name",
  emailLabel: "[COPY] Email address",
  emailPlaceholder: "[COPY] Email",
  passwordLabel: "[COPY] Password",
  passwordPlaceholder: `[COPY] Password (${MIN_PASSWORD_LENGTH}+ characters)`,

  submit: "[COPY] Create account",
  haveAccount: "[COPY] Already have an account?",
  signIn: "[COPY] Sign in",
} as const;

const ERROR_MESSAGES: Record<string, string> = {
  email_in_use: "[COPY] That email is already registered.",
  invite_invalid: "[COPY] That invite code isn't valid.",
  invite_used: "[COPY] That invite code has already been used.",
  invite_expired: "[COPY] That invite code has expired.",
  password_short: `[COPY] Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
};

const GENERIC_ERROR = "[COPY] Something went wrong. Please try again.";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? GENERIC_ERROR)
    : null;

  return (
    <AuthShell>
      <Wordmark>{COPY.wordmark}</Wordmark>

      <AuthSheet>
        <AuthHeading>{COPY.lede}</AuthHeading>
        <p
          className="mt-2"
          style={{ fontSize: "12.5px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
        >
          {COPY.inviteNote}
        </p>

        {/* The form's action, method and field names are what the API reads.
            Nothing about this rebuild touched them. */}
        <form
          action="/api/auth/signup"
          method="POST"
          className="mt-5 flex flex-col gap-[14px]"
        >
          {/* autoFocus is on this field only. It used to be on the display name
              as well, which is not a thing two fields can share — the browser
              takes one and the other is a no-op. */}
          <AuthField
            id="invite-code"
            name="inviteCode"
            label={COPY.inviteLabel}
            placeholder={COPY.invitePlaceholder}
            mono
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
          <AuthField
            id="display-name"
            name="displayName"
            label={COPY.nameLabel}
            placeholder={COPY.namePlaceholder}
            autoComplete="name"
          />
          <AuthField
            id="email"
            name="email"
            type="email"
            label={COPY.emailLabel}
            placeholder={COPY.emailPlaceholder}
            autoComplete="email"
          />
          <AuthField
            id="password"
            name="password"
            type="password"
            label={COPY.passwordLabel}
            placeholder={COPY.passwordPlaceholder}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />

          {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

          <div className="mt-1">
            <AuthSubmit>{COPY.submit}</AuthSubmit>
          </div>
        </form>
      </AuthSheet>

      <AuthFooter>
        {COPY.haveAccount}{" "}
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
