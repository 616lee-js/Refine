"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = { tendencies: string; goals: string; background: string };

const EMPTY: Profile = { tendencies: "", goals: "", background: "" };

export default function ProfileSettingsPage() {
  const [draft, setDraft] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data: Profile) => {
        setDraft(data);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
          <span className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
            Profile
          </span>
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
        <p className="text-sm text-stone-500 mb-8 leading-relaxed">
          This profile is shared with Claude at the start of every reflection. All fields are optional — fill in what&apos;s useful, leave blank what isn&apos;t.
        </p>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="tendencies" className="block text-sm text-stone-600 mb-1.5">
                How would you describe yourself?
              </label>
              <p className="text-xs text-stone-400 mb-2">
                Patterns you notice in how you think, feel, or move through the world.
              </p>
              <textarea
                id="tendencies"
                value={draft.tendencies}
                onChange={(e) => setDraft((d) => ({ ...d, tendencies: e.target.value }))}
                rows={3}
                placeholder="e.g. I tend to overthink decisions, get overwhelmed when there's too much on my plate…"
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
              />
            </div>

            <div>
              <label htmlFor="goals" className="block text-sm text-stone-600 mb-1.5">
                What do you want to get from this practice?
              </label>
              <p className="text-xs text-stone-400 mb-2">
                What you&apos;re working toward, or what brought you here.
              </p>
              <textarea
                id="goals"
                value={draft.goals}
                onChange={(e) => setDraft((d) => ({ ...d, goals: e.target.value }))}
                rows={3}
                placeholder="e.g. I want to understand my anxiety better and find ways to feel less reactive…"
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
              />
            </div>

            <div>
              <label htmlFor="background" className="block text-sm text-stone-600 mb-1.5">
                Any background context you want the app to know?
              </label>
              <p className="text-xs text-stone-400 mb-2">
                Life context, relevant history, anything that might help the app understand you better.
              </p>
              <textarea
                id="background"
                value={draft.background}
                onChange={(e) => setDraft((d) => ({ ...d, background: e.target.value }))}
                rows={3}
                placeholder="Optional — share as much or as little as you like."
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="text-xs text-stone-400">Saved.</span>
              )}
            </div>
          </form>
        )}

        <div className="mt-10 pt-6 border-t border-stone-100">
          <Link
            href="/settings/system-prompt"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            View the system prompt
          </Link>
          <p className="mt-1 text-xs text-stone-400 leading-relaxed">
            The standing instructions Claude is given at the start of every reflection.
          </p>
        </div>
      </main>
    </div>
  );
}
