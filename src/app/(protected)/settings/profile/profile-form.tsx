"use client";

import { useEffect, useState } from "react";
import { PageBg } from "@/components/ui/page-bg";
import { Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Preferences } from "./preferences";
import {
  ProfileAnswers,
  EMPTY_PROFILE,
  type Profile,
} from "./profile-answers";
import type { Mode, Palette } from "@/lib/appearance";

/**
 * Profile — two sections, both of which open and close.
 *
 * ── Why the answers are a section rather than a form ──────────────────────────
 * The three questions used to be three open text boxes with one Save. Each is
 * now read back as text and edited one at a time, so there is no page-level form
 * and no page-level Save — see ./profile-answers.tsx.
 *
 * Preferences was already separate, because it saves the moment you pick rather
 * than on a button. Both are now titled and collapsible, so the page reads as
 * two things you can put away rather than one long column.
 */

const FIELDS: {
  key: keyof Profile;
  label: string;
  note: string;
  placeholder: string;
}[] = [
  {
    key: "tendencies",
    label: "[COPY] How would you describe yourself?",
    note: "[COPY] Patterns you notice in how you think, feel, or move through the world.",
    placeholder: "[COPY] e.g. I tend to overthink decisions, get overwhelmed when there's too much on my plate…",
  },
  {
    key: "goals",
    label: "[COPY] What do you want from this practice?",
    note: "[COPY] What you're working toward, or what brought you here.",
    placeholder: "[COPY] e.g. I want to understand my anxiety better and feel less reactive…",
  },
  {
    key: "background",
    label: "[COPY] Any background worth knowing?",
    note: "[COPY] Life context, relevant history, anything that helps Refine understand you.",
    placeholder: "[COPY] Optional — as much or as little as you like.",
  },
];

// COPY REVIEW: the loose prose. Field labels and notes are marked inline above.
const COPY = {
  eyebrow: "[COPY] Profile",
  headline: "[COPY] What you've told Refine about you",
  lede:
    "[COPY] Standing context you can set once and forget. All three are optional and editable whenever you like.",
  loading: "[COPY] Loading…",
  answersTitle: "[COPY] About you",
  answersNote:
    "[COPY] Three questions, answered whenever you like. Edit one at a time.",
} as const;

export function ProfileForm({
  admin,
  initialPalette,
  initialMode,
}: {
  admin: React.ReactNode;
  initialPalette: Palette;
  initialMode: Mode;
}) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : EMPTY_PROFILE))
      .then((data: Profile) => {
        setProfile(data ?? EMPTY_PROFILE);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <PageBg>
      <TopNav active="profile" admin={admin} />

      <div className="flex min-h-0 flex-1 justify-center px-5 pt-[26px]">
        <div className="w-full pb-14" style={{ maxWidth: 820 }}>
          <Eyebrow>{COPY.eyebrow}</Eyebrow>
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
            {COPY.headline}
          </h1>
          <p
            className="mb-7 max-w-[460px]"
            style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--rf-text-3)" }}
          >
            {/* CONTENT PASS: the old wording said this is "shared with Claude at
                the start of every reflection", which stopped being true when the
                conversational surface was retired. Nothing reads it yet. */}
            {COPY.lede}
          </p>

          {loading ? (
            <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
              {COPY.loading}
            </p>
          ) : (
            <CollapsibleSection
              title={COPY.answersTitle}
              note={COPY.answersNote}
            >
              <ProfileAnswers
                fields={FIELDS}
                profile={profile}
                onSaved={setProfile}
              />
            </CollapsibleSection>
          )}

          {/* Separate because it saves on pick rather than on a button.
              See ./preferences.tsx. */}
          <Preferences initialPalette={initialPalette} initialMode={initialMode} />
        </div>
      </div>
    </PageBg>
  );
}
