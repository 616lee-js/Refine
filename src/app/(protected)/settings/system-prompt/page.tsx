import Link from "next/link";
import systemPrompt from "@/lib/layer2/system-prompt.md";

/**
 * Read-only view of the Layer 2 system prompt.
 *
 * This exists because of the transparency principle: users understand what the
 * AI is instructed to do. Read-only by design — the prompt is not user-editable.
 *
 * Scope is Layer 2 only, which is what the planning doc commits to. Layer 3
 * clinical reference fragments (tier protocols, crisis resources) are a separate
 * question and are deliberately not surfaced here.
 */
export default function SystemPromptPage() {
  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <Link href="/reflections" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Reflections
          </Link>
          <Link href="/mirror" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Mirror
          </Link>
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <Link href="/" className="px-3 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-50 transition-colors">
            New reflection
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        <Link
          href="/settings/profile"
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Back to profile
        </Link>

        <h2 className="mt-6 text-sm font-medium text-stone-800">System prompt</h2>

        <div className="mt-3 space-y-3 text-sm text-stone-500 leading-relaxed">
          <p>
            These are the standing instructions given to Claude at the start of every
            reflection. They are the same for everyone and do not change based on what
            you write.
          </p>
          <p>
            This is shown so you can see what shapes the responses you get. It is
            read-only — you can&apos;t edit it, and neither can Claude.
          </p>
          <p>
            Separately, Claude receives your profile and any confirmed entries in your{" "}
            <Link
              href="/mirror"
              className="underline underline-offset-2 hover:text-stone-700 transition-colors"
            >
              Mirror
            </Link>
            . Those are yours to edit or delete at any time.
          </p>
        </div>

        <pre className="mt-6 whitespace-pre-wrap break-words rounded-xl border border-stone-200 bg-stone-50 px-5 py-4 text-xs text-stone-600 leading-relaxed font-mono">
          {systemPrompt}
        </pre>
      </main>

    </div>
  );
}
