"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";

type Profile = { tendencies: string; goals: string; background: string };

const EMPTY: Profile = { tendencies: "", goals: "", background: "" };

const FIELDS: {
  key: keyof Profile;
  label: string;
  note: string;
  placeholder: string;
}[] = [
  {
    key: "tendencies",
    label: "How would you describe yourself?",
    note: "Patterns you notice in how you think, feel, or move through the world.",
    placeholder:
      "e.g. I tend to overthink decisions, get overwhelmed when there's too much on my plate…",
  },
  {
    key: "goals",
    label: "What do you want from this practice?",
    note: "What you're working toward, or what brought you here.",
    placeholder:
      "e.g. I want to understand my anxiety better and feel less reactive…",
  },
  {
    key: "background",
    label: "Any background worth knowing?",
    note: "Life context, relevant history, anything that helps Refine understand you.",
    placeholder: "Optional — as much or as little as you like.",
  },
];

export function ProfileForm({ admin }: { admin: React.ReactNode }) {
  const [draft, setDraft] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: Profile) => {
        setDraft(data ?? EMPTY);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      // Previously the result was ignored and "Saved." appeared regardless.
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageBg>
      <TopNav active="profile" admin={admin} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 640 }}>
          <Eyebrow>Profile</Eyebrow>
          <h1
            className="mb-[8px] mt-[9px]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "30px",
              fontWeight: 380,
              letterSpacing: "-0.02em",
              color: "var(--rf-text)",
            }}
          >
            What you&apos;ve told Refine about you
          </h1>
          <p
            className="mb-6 max-w-[460px]"
            style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
          >
            {/* CONTENT PASS: the old wording said this is "shared with Claude at
                the start of every reflection", which stopped being true when the
                conversational surface was retired. Nothing reads it yet. */}
            Standing context you can set once and forget. All three are optional
            and editable whenever you like.
          </p>

          {loading ? (
            <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
              Loading…
            </p>
          ) : (
            <form onSubmit={save}>
              <Sheet className="flex flex-col gap-[22px] px-7 py-7 sm:px-8">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label
                      htmlFor={f.key}
                      className="block"
                      style={{ fontSize: "14px", color: "var(--rf-text)" }}
                    >
                      {f.label}
                    </label>
                    <p
                      className="mb-[9px] mt-[3px]"
                      style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
                    >
                      {f.note}
                    </p>
                    <textarea
                      id={f.key}
                      value={draft[f.key]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                      }
                      rows={3}
                      placeholder={f.placeholder}
                      className="w-full resize-none rounded-[4px] px-4 py-3 outline-none"
                      style={{
                        fontSize: "13.5px",
                        lineHeight: 1.6,
                        color: "var(--rf-text)",
                        background: "var(--rf-surface)",
                        boxShadow: "inset 0 0 0 1px var(--rf-border)",
                      }}
                    />
                  </div>
                ))}
              </Sheet>

              <div className="mt-[16px] flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full transition-colors disabled:opacity-40"
                  style={{
                    padding: "9px 18px",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    background: "var(--rf-text)",
                    color: "var(--rf-paper)",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <span
                  aria-live="polite"
                  className="font-mono uppercase"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                    color:
                      status === "failed"
                        ? "var(--color-error)"
                        : "var(--rf-text-4)",
                  }}
                >
                  {status === "saved"
                    ? "Saved"
                    : status === "failed"
                      ? "Didn't save — your text is still here"
                      : ""}
                </span>
              </div>
            </form>
          )}

          <div
            className="mt-10 pt-5"
            style={{ borderTop: "1px solid var(--rf-rule)" }}
          >
            <Link
              href="/settings/system-prompt"
              className="font-mono uppercase"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-3)",
              }}
            >
              The system prompt →
            </Link>
            <p
              className="mt-[6px] max-w-[420px]"
              style={{
                fontSize: "11.5px",
                lineHeight: 1.55,
                color: "var(--rf-text-4)",
              }}
            >
              The standing instructions Claude is given, readable in full.
            </p>
          </div>
        </div>
      </div>
    </PageBg>
  );
}
