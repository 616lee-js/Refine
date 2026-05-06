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
          <h1 className="text-2xl font-semibold tracking-tight">Refine</h1>
          <p className="text-sm text-stone-500">Enter your passphrase to continue</p>
        </div>

        <form action="/api/auth/login" method="POST" className="space-y-4">
          <div>
            <label htmlFor="passphrase" className="sr-only">
              Passphrase
            </label>
            <input
              id="passphrase"
              name="passphrase"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              placeholder="Passphrase"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              Invalid passphrase.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
