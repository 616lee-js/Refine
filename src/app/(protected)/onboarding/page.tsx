"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = { tendencies: string; goals: string; background: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Profile>({ tendencies: "", goals: "", background: "" });
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    setSaving(true);
    const hasContent = draft.tendencies.trim() || draft.goals.trim() || draft.background.trim();
    if (hasContent) {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
    }
    router.push("/");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-stone-800">
      <header className="shrink-0 px-6 py-4 border-b border-stone-100">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine
        </h1>
      </header>

      <main className="flex-1 px-6 py-10 max-w-md mx-auto w-full space-y-8">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-stone-800">Welcome.</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Refine learns about you through use. These fields are optional — fill in what feels relevant now, or skip them and come back later in Settings.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="tendencies" className="block text-sm text-stone-600 mb-1.5">
              How would you describe yourself?
            </label>
            <textarea
              id="tendencies"
              value={draft.tendencies}
              onChange={(e) => setDraft((d) => ({ ...d, tendencies: e.target.value }))}
              rows={2}
              placeholder="Patterns in how you think, feel, or move through the world…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
            />
          </div>

          <div>
            <label htmlFor="goals" className="block text-sm text-stone-600 mb-1.5">
              What do you want to get from this practice?
            </label>
            <textarea
              id="goals"
              value={draft.goals}
              onChange={(e) => setDraft((d) => ({ ...d, goals: e.target.value }))}
              rows={2}
              placeholder="What brought you here, or what you're working toward…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
            />
          </div>

          <div>
            <label htmlFor="background" className="block text-sm text-stone-600 mb-1.5">
              Any background context? <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="background"
              value={draft.background}
              onChange={(e) => setDraft((d) => ({ ...d, background: e.target.value }))}
              rows={2}
              placeholder="Anything else that might help Refine understand you better…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={saving}
          className="w-full px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
        >
          {saving ? "Starting…" : "Get started"}
        </button>

        <p className="text-xs text-stone-400 text-center">
          You can update this anytime in{" "}
          <Link href="/settings/profile" className="hover:text-stone-600 transition-colors underline underline-offset-2">
            Profile Settings
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
