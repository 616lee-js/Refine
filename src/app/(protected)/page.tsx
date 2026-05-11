"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SessionType = "as_needed" | "scheduled";
type Step = "type" | "checkin";

export default function Page() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("type");
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [presentText, setPresentText] = useState("");
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [intentionText, setIntentionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectType(type: SessionType) {
    setSessionType(type);
    setStep("checkin");
  }

  async function startSession(skipCheckin = false) {
    if (!sessionType) return;
    setLoading(true);
    setError(null);

    const checkin: Record<string, unknown> = {};
    if (!skipCheckin) {
      if (sessionType === "as_needed" && presentText.trim()) {
        checkin.presentText = presentText.trim();
      }
      if (sessionType === "scheduled") {
        if (moodRating !== null) checkin.mood = { rating: moodRating };
        if (presentText.trim()) checkin.presentText = presentText.trim();
        if (intentionText.trim()) checkin.intentionText = intentionText.trim();
      }
    }

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: sessionType, checkin }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { sessionId } = (await res.json()) as { sessionId: string };
      router.push(`/session/${sessionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (step === "type") {
    return (
      <div className="flex flex-col h-screen bg-white text-stone-800">
        <header className="shrink-0 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
            Refine
          </h1>
          <div className="flex items-center gap-4">
            <a
              href="/sessions"
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Reflections
            </a>
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
              How would you like to start?
            </p>
            <button
              onClick={() => selectType("as_needed")}
              className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors"
            >
              <div className="text-sm font-medium text-stone-800">
                Start when ready
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Open-ended reflection, whenever you need it
              </div>
            </button>
            <button
              onClick={() => selectType("scheduled")}
              className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors"
            >
              <div className="text-sm font-medium text-stone-800">
                Scheduled session
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Structured check-in to track how you&apos;re doing over time
              </div>
            </button>
            <button
              disabled
              className="w-full text-left px-5 py-4 rounded-xl border border-stone-100 opacity-40 cursor-not-allowed"
            >
              <div className="text-sm font-medium text-stone-600">
                Guided session
              </div>
              <div className="text-xs text-stone-400 mt-0.5">Coming soon</div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Step: checkin
  return (
    <div className="flex flex-col h-screen bg-white text-stone-800">
      <header className="shrink-0 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep("type")}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
            Refine
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/sessions"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Reflections
          </a>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-5">
          {sessionType === "as_needed" && (
            <>
              <label
                htmlFor="present-text"
                className="block text-sm text-stone-600"
              >
                What&apos;s bringing you here today?
              </label>
              <textarea
                id="present-text"
                value={presentText}
                onChange={(e) => setPresentText(e.target.value)}
                rows={4}
                placeholder="Optional — you can skip this"
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={() => startSession(false)}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Starting…" : "Start"}
              </button>
            </>
          )}

          {sessionType === "scheduled" && (
            <>
              <div>
                <p className="text-sm font-medium text-stone-700 mb-3">
                  How are you feeling right now?
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMoodRating(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        moodRating === n
                          ? "bg-stone-800 text-white"
                          : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-xs text-stone-400 px-0.5">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="present-text"
                  className="block text-sm text-stone-600 mb-1.5"
                >
                  How are you doing right now, in a few words?
                </label>
                <textarea
                  id="present-text"
                  value={presentText}
                  onChange={(e) => setPresentText(e.target.value)}
                  rows={3}
                  placeholder="How are you feeling, what's on your mind…"
                  className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="intention-text"
                  className="block text-sm text-stone-600 mb-1.5"
                >
                  Since last time…{" "}
                  <span className="text-stone-400">(optional)</span>
                </label>
                <textarea
                  id="intention-text"
                  value={intentionText}
                  onChange={(e) => setIntentionText(e.target.value)}
                  rows={2}
                  placeholder="Anything notable since your last reflection…"
                  className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={() => startSession(false)}
                disabled={loading || !presentText.trim()}
                className="w-full px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Starting…" : "Begin session"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
