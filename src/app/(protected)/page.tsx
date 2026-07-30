"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";

/**
 * Home.
 *
 * STEP 1 SCOPE: this is a minimal Dawn restyle to prove the token layer, the
 * fonts, PageBg and Sheet on a real page. The designed ScreenHome — continuity
 * line, tracker strip, Recent list, Mirror sparkline — is Step 5.
 *
 * The type picker and check-in step from the chat model are gone: they existed
 * to configure a conversation. A journal entry needs neither; you open it and
 * write.
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
    <PageBg>
      <TopNav active="today" />

      <main className="flex-1 px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[780px]">
          <h1
            className="mb-8 max-w-[560px]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "27px",
              lineHeight: 1.34,
              fontWeight: 380,
              letterSpacing: "-0.02em",
              color: "var(--rf-text)",
            }}
          >
            What would you like to set down?
          </h1>

          <div className="grid gap-[18px] sm:grid-cols-2">
            <Sheet minHeight={168} className="p-[20px_22px_18px]">
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow accent size={9.5}>
                  Open reflection
                </Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "22px",
                    lineHeight: 1.2,
                    fontWeight: 380,
                    letterSpacing: "-0.014em",
                    color: "var(--rf-text)",
                  }}
                >
                  Write what&apos;s there
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  Nothing to answer. A few footholds wait in the margin if you
                  want a way in.
                </p>
                <div>
                  <button
                    onClick={startEntry}
                    disabled={loading}
                    className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--rf-text)",
                      color: "var(--rf-paper)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                    }}
                  >
                    {loading ? "Opening…" : "Begin"}
                  </button>
                </div>
              </div>
            </Sheet>

            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5 opacity-50">
                <Eyebrow size={9.5}>Framework</Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "22px",
                    lineHeight: 1.2,
                    fontWeight: 380,
                    letterSpacing: "-0.014em",
                    color: "var(--rf-text)",
                  }}
                >
                  Answer a few questions
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  Seven questions, then back to your own words. Coming next.
                </p>
              </div>
            </Sheet>
          </div>

          {error && (
            <p
              className="mt-4 text-center"
              style={{ fontSize: "12.5px", color: "var(--color-error)" }}
            >
              {error}
            </p>
          )}
        </div>
      </main>
    </PageBg>
  );
}

/**
 * Shared top nav. Reflections · Mirror · Profile — the repo's vocabulary, not
 * the design's "Entries".
 */
function TopNav({ active }: { active: "today" | "reflections" | "mirror" }) {
  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className="transition-colors"
      style={{
        fontSize: "13.5px",
        color: active === key ? "var(--rf-text)" : "var(--rf-text-3)",
        fontWeight: active === key ? 500 : 400,
      }}
    >
      {label}
    </Link>
  );

  return (
    <header
      className="flex shrink-0 items-center justify-between px-6 py-4 sm:px-10"
      style={{ borderBottom: "1px solid var(--rf-border)" }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "19px",
          fontWeight: 400,
          letterSpacing: "-0.01em",
          color: "var(--rf-text)",
        }}
      >
        Refine
        <span style={{ color: "var(--rf-accent)" }}>.</span>
      </Link>

      <nav className="flex items-center gap-6">
        {link("/reflections", "Reflections", "reflections")}
        {link("/mirror", "Mirror", "mirror")}
        <Link
          href="/settings/profile"
          className="transition-colors"
          style={{ fontSize: "13.5px", color: "var(--rf-text-3)" }}
        >
          Profile
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            style={{ fontSize: "13.5px", color: "var(--rf-text-3)" }}
          >
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
