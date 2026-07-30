"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Home screen.
 *
 * The type picker and check-in step are gone. They existed to configure a
 * conversation — which reflection shape Claude should adopt, and what context to
 * give it before it started responding. A journal entry needs neither: you open
 * it and write.
 *
 * The framework check-in is a separate workflow and will get its own entry point
 * when it is designed.
 */
export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEntry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reflections", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { reflectionId } = (await res.json()) as { reflectionId: string };
      router.push(`/reflection/${reflectionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white text-stone-800">
      <header className="shrink-0 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/reflections"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Reflections
          </Link>
          <Link
            href="/mirror"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Mirror
          </Link>
          <Link
            href="/settings/profile"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Profile
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-3">
          <p className="text-sm text-stone-500 mb-6 text-center">
            What would you like to do?
          </p>

          <button
            onClick={startEntry}
            disabled={loading}
            className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            <div className="text-sm font-medium text-stone-800">
              {loading ? "Opening…" : "Write a reflection"}
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              Open-ended writing, whenever you need it
            </div>
          </button>

          <button
            disabled
            className="w-full text-left px-5 py-4 rounded-xl border border-stone-100 opacity-40 cursor-not-allowed"
          >
            <div className="text-sm font-medium text-stone-600">Check-in</div>
            <div className="text-xs text-stone-400 mt-0.5">Coming soon</div>
          </button>

          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        </div>
      </main>
    </div>
  );
}
