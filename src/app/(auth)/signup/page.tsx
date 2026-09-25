import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

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
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{COPY.wordmark}</h1>
          <p className="text-sm text-stone-500">{COPY.lede}</p>
          <p className="text-xs text-stone-400 pt-1">
            {COPY.inviteNote}
          </p>
        </div>

        <form action="/api/auth/signup" method="POST" className="space-y-3">
          <div>
            <label htmlFor="invite-code" className="sr-only">
              {COPY.inviteLabel}
            </label>
            <input
              id="invite-code"
              name="inviteCode"
              type="text"
              required
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono tracking-wide uppercase placeholder:text-stone-400 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={COPY.invitePlaceholder}
            />
          </div>
          <div>
            <label htmlFor="display-name" className="sr-only">
              {COPY.nameLabel}
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              required
              autoFocus
              autoComplete="name"
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={COPY.namePlaceholder}
            />
          </div>
          <div>
            <label htmlFor="email" className="sr-only">
              {COPY.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={COPY.emailPlaceholder}
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              {COPY.passwordLabel}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={COPY.passwordPlaceholder}
            />
          </div>

          {errorMessage && (
            <Notice tone="error">{errorMessage}</Notice>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 transition-colors"
          >
            {COPY.submit}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          {COPY.haveAccount}{" "}
          <Link href="/login" className="font-medium text-stone-800 hover:underline">
            {COPY.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
