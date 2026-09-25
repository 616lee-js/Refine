import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import {
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthSheet,
  AuthShell,
  AuthSubmit,
  Wordmark,
} from "../auth-ui";

// COPY REVIEW: all of it — headings, labels, placeholders and errors.
const COPY = {
  wordmark: "[COPY] Refine",
  lede: "[COPY] Sign in to continue",
  emailLabel: "[COPY] Email address",
  emailPlaceholder: "[COPY] Email",
  passwordLabel: "[COPY] Password",
  passwordPlaceholder: "[COPY] Password",
  error: "[COPY] Invalid email or password.",
  submit: "[COPY] Sign in",
  noAccount: "[COPY] No account?",
  createOne: "[COPY] Create one",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <Wordmark>{COPY.wordmark}</Wordmark>

      <AuthSheet>
        <AuthHeading>{COPY.lede}</AuthHeading>

        {/* The form's action, method and field names are what the API reads.
            Nothing about this rebuild touched them. */}
        <form
          action="/api/auth/login"
          method="POST"
          className="mt-5 flex flex-col gap-[14px]"
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
            id="password"
            name="password"
            type="password"
            label={COPY.passwordLabel}
            placeholder={COPY.passwordPlaceholder}
            autoComplete="current-password"
          />

          {error && <Notice tone="error">{COPY.error}</Notice>}

          <div className="mt-1">
            <AuthSubmit>{COPY.submit}</AuthSubmit>
          </div>
        </form>
      </AuthSheet>

      <AuthFooter>
        {COPY.noAccount}{" "}
        <Link
          href="/signup"
          style={{
            color: "var(--rf-text-2)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {COPY.createOne}
        </Link>
      </AuthFooter>
    </AuthShell>
  );
}
