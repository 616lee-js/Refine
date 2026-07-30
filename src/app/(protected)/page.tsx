"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";

/**
 * Home.
 *
 * Two ways in, both producing entries. The designed ScreenHome — continuity
 * line, tracker strip, Recent list, Mirror sparkline — is Step 5, and several
 * of those need Phase 6 data that does not exist yet.
 *
 * The type picker and check-in step from the chat model are gone: they existed
 * to configure a conversation. A journal entry needs neither; you open it and
 * write.
 */
export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState<"entry" | "framework" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startEntry() {
    setLoading("entry");
    setError(null);
    try {
      const res = await fetch("/api/reflections", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { reflectionId } = (await res.json()) as { reflectionId: string };
      router.push(`/reflection/${reflectionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  async function startFramework(slug: string) {
    setLoading("framework");
    setError(null);
    try {
      const res = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { responseId } = (await res.json()) as { responseId: string };
      router.push(`/framework/${responseId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
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
            What would you like to do?
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
                    disabled={loading !== null}
                    className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--rf-text)",
                      color: "var(--rf-paper)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                    }}
                  >
                    {loading === "entry" ? "Opening…" : "Begin"}
                  </button>
                </div>
              </div>
            </Sheet>

            <Sheet minHeight={168}>
              <div className="flex flex-1 flex-col gap-[10px] p-5">
                <Eyebrow size={9.5}>Framework · GAD-7</Eyebrow>
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
                  Generalised anxiety
                </h2>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text-3)",
                  }}
                >
                  Seven questions, then back to your own words.
                </p>
                <div>
                  <button
                    onClick={() => startFramework("gad7")}
                    disabled={loading !== null}
                    className="rounded-full px-4 py-2 transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--rf-text)",
                      color: "var(--rf-paper)",
                      fontSize: "12.5px",
                      fontWeight: 500,
                    }}
                  >
                    {loading === "framework" ? "Opening…" : "Start"}
                  </button>
                </div>
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
