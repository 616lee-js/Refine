import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  email_in_use: "That email is already registered.",
  invite_invalid: "That invite code isn't valid.",
  invite_used: "That invite code has already been used.",
  invite_expired: "That invite code has expired.",
  password_short: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.")
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Refine</h1>
          <p className="text-sm text-stone-500">Create your account</p>
          <p className="text-xs text-stone-400 pt-1">
            Refine is invite-only while it&apos;s in testing.
          </p>
        </div>

        <form action="/api/auth/signup" method="POST" className="space-y-3">
          <div>
            <label htmlFor="invite-code" className="sr-only">
              Invite code
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
              placeholder="Invite code"
            />
          </div>
          <div>
            <label htmlFor="display-name" className="sr-only">
              Display name
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              required
              autoFocus
              autoComplete="name"
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder="Display name"
            />
          </div>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder="Email"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={`Password (${MIN_PASSWORD_LENGTH}+ characters)`}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 transition-colors"
          >
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-stone-800 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
