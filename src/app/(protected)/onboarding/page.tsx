"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageBg } from "@/components/ui/page-bg";
import { Eyebrow } from "@/components/ui/sheet";
import { Wordmark } from "@/components/ui/top-nav";

/**
 * Onboarding.
 *
 * ── ALL COPY HERE IS PLACEHOLDER ──────────────────────────────────────────────
 * This is the first framing a person receives, and it is content-pass territory.
 * The structure below is real; the words are stand-ins.
 *
 * ── What was NOT built from the design, and why ───────────────────────────────
 * The reference screen has a "choose what to keep track of" picker — chips for
 * GAD-7, PHQ-9, sleep, medication, and so on. It is not built, because it is not
 * a copy question: it implies per-user instrument enablement, which this product
 * has no model for. Instruments are global today (`listStartable()`), and making
 * them per-user means a preferences shape or a new table, plus a Home screen
 * that reads it. That is a scope decision, not a screen.
 *
 * The reference also shows "Step 2 of 3". There is one step here. Multi-step
 * onboarding is a structural choice about how much to ask before someone writes
 * anything, and it stays one screen until that is decided.
 *
 * Crisis resources are deliberately absent. Where and how they are introduced is
 * a content decision that has not been made, and placeholder crisis copy is the
 * one kind of placeholder that can do harm if it ships — a stand-in number or a
 * stand-in framing is worse than nothing. It goes in with the content pass.
 */

type Profile = { tendencies: string; goals: string; background: string };

const FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  {
    key: "tendencies",
    label: "How would you describe yourself?",
    placeholder: "Patterns in how you think, feel, or move through the world…",
  },
  {
    key: "goals",
    label: "What do you want from this practice?",
    placeholder: "What brought you here, or what you're working toward…",
  },
  {
    key: "background",
    label: "Any background worth knowing?",
    placeholder: "Anything else that helps Refine understand you…",
  },
];

const WAYS_IN: [string, string][] = [
  [
    "Open reflection",
    "A blank page. A few footholds sit in the margin if you want a way in, then it gets out of the way.",
  ],
  [
    "Framework",
    "Established questionnaires and a short daily check-in, whenever you want them. Scored, kept, charted. Never diagnosed.",
  ],
];

export default function OnboardingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Profile>({
    tendencies: "",
    goals: "",
    background: "",
  });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setSaving(true);
    setFailed(false);
    const hasContent =
      draft.tendencies.trim() || draft.goals.trim() || draft.background.trim();

    if (hasContent) {
      try {
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        // The previous version navigated regardless of the result, so a failed
        // save looked exactly like a successful one and the answers were gone.
        // Staying put is the only thing that keeps the text.
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setSaving(false);
        setFailed(true);
        return;
      }
    }
    router.push("/");
  }

  return (
    <PageBg>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        {/* Explainer. Below lg it stacks above the fields, so the framing is
            still what gets read first. */}
        <div
          className="flex flex-col px-7 py-10 sm:px-12 sm:py-14 lg:border-r"
          style={{ borderColor: "var(--rf-border)" }}
        >
          <Wordmark />

          <div className="mb-auto mt-auto pt-9">
            <Eyebrow>Getting started</Eyebrow>
            <h1
              className="mb-[18px] mt-4 max-w-[420px]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(27px, 4.4vw, 40px)",
                fontWeight: 380,
                lineHeight: 1.14,
                letterSpacing: "-0.024em",
                color: "var(--rf-text)",
              }}
            >
              Two ways in. Both are <em>writing</em>.
            </h1>

            <div className="flex max-w-[400px] flex-col gap-5">
              {WAYS_IN.map(([title, body]) => (
                <div key={title}>
                  <Eyebrow accent size={9.5}>
                    {title}
                  </Eyebrow>
                  <p
                    className="mt-[7px]"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "16.5px",
                      lineHeight: 1.6,
                      color: "var(--rf-text-2)",
                      textWrap: "pretty",
                    }}
                  >
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p
            className="mt-10 max-w-[380px]"
            style={{
              fontSize: "12px",
              lineHeight: 1.55,
              color: "var(--rf-text-4)",
            }}
          >
            Refine is not a therapist and not a chatbot. It reads what you write
            so it can ask better questions next time.
          </p>
        </div>

        {/* Profile capture — the part that actually persists. */}
        <div className="flex flex-col justify-center px-7 py-10 sm:px-12 sm:py-14">
          <Eyebrow>A little context, if you want</Eyebrow>
          <p
            className="mb-6 mt-[10px] max-w-[440px]"
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--rf-text-3)",
            }}
          >
            All three are optional and all three are editable later. Skipping
            costs nothing.
          </p>

          <div className="flex max-w-[440px] flex-col gap-[18px]">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label
                  htmlFor={f.key}
                  className="mb-[7px] block"
                  style={{ fontSize: "13px", color: "var(--rf-text-2)" }}
                >
                  {f.label}
                </label>
                <textarea
                  id={f.key}
                  value={draft[f.key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  rows={2}
                  placeholder={f.placeholder}
                  className="w-full resize-none rounded-[4px] px-4 py-3 outline-none"
                  style={{
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: "var(--rf-text)",
                    background: "var(--rf-paper)",
                    boxShadow: "inset 0 0 0 1px var(--rf-border)",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-7 flex max-w-[440px] flex-wrap items-center gap-x-5 gap-y-3">
            <button
              onClick={start}
              disabled={saving}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "10px 20px",
                fontSize: "13.5px",
                fontWeight: 500,
                background: "var(--rf-text)",
                color: "var(--rf-paper)",
              }}
            >
              {saving ? "Starting…" : "Continue"}
            </button>
            <button
              onClick={() => router.push("/")}
              disabled={saving}
              style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
            >
              Skip — just let me write
            </button>
          </div>

          {failed && (
            <p
              aria-live="polite"
              className="mt-4 max-w-[440px]"
              style={{
                fontSize: "12.5px",
                lineHeight: 1.55,
                color: "var(--color-error)",
              }}
            >
              That didn&apos;t save, so your answers are still here. Try again,
              or skip and add them later.
            </p>
          )}

          <p
            className="mt-6 max-w-[440px]"
            style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
          >
            Editable any time in{" "}
            <Link
              href="/settings/profile"
              className="underline underline-offset-2"
            >
              Profile
            </Link>
            .
          </p>
        </div>
      </div>
    </PageBg>
  );
}
