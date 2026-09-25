import Link from "next/link";
import { Notice } from "@/components/ui/notice";

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
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{COPY.wordmark}</h1>
          <p className="text-sm text-stone-500">{COPY.lede}</p>
        </div>

        <form action="/api/auth/login" method="POST" className="space-y-3">
          <div>
            <label htmlFor="email" className="sr-only">
              {COPY.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
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
              autoComplete="current-password"
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-colors"
              placeholder={COPY.passwordPlaceholder}
            />
          </div>

          {error && (
            <Notice tone="error">{COPY.error}</Notice>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 transition-colors"
          >
            {COPY.submit}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          {COPY.noAccount}{" "}
          <Link href="/signup" className="font-medium text-stone-800 hover:underline">
            {COPY.createOne}
          </Link>
        </p>
      </div>
    </main>
  );
}
