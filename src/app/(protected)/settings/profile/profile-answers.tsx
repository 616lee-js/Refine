"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";

/**
 * The three standing questions, one at a time.
 *
 * ── Reading is the default, not writing ───────────────────────────────────────
 * These were three open text boxes, always editable, with one Save at the
 * bottom. Coming back to the page put you in front of an editor you had not
 * asked for, and what you had written looked like a draft rather than an
 * answer. Now an answer reads as text, and editing is something you choose.
 *
 * ── One question at a time ────────────────────────────────────────────────────
 * Each has its own Edit and saves on its own, so a failure affects only the
 * answer you were working on. The trade is three saves if you want to change
 * all three; that was the product owner's call.
 *
 * ── Every save still sends all three ──────────────────────────────────────────
 * The stored profile is one encrypted blob and `PUT /api/user/profile` replaces
 * it whole — a missing field is stored as empty, not left alone. So the two
 * answers you are not editing travel along unchanged. They come from the copy
 * already loaded on this page, which is also why the editor is not opened until
 * the load has finished.
 */

export type Profile = { tendencies: string; goals: string; background: string };

export const EMPTY_PROFILE: Profile = {
  tendencies: "",
  goals: "",
  background: "",
};

// COPY REVIEW: the controls and the empty state. Question labels and notes come
// from FIELDS in profile-form.tsx and are already marked.
const COPY = {
  edit: "[COPY] Edit",
  add: "[COPY] Add",
  cancel: "[COPY] Cancel",
  save: "[COPY] Save",
  saving: "[COPY] Saving…",
  saved: "[COPY] Saved",
  unanswered: "[COPY] Nothing here yet.",
  saveError: "[COPY] Didn't save — your text is still here",
} as const;

export function ProfileAnswer({
  field,
  label,
  note,
  placeholder,
  profile,
  onSaved,
}: {
  field: keyof Profile;
  label: string;
  note: string;
  placeholder: string;
  /** All three answers — the other two are sent unchanged on save. */
  profile: Profile;
  onSaved: (next: Profile) => void;
}) {
  const value = profile[field];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  function startEditing() {
    setDraft(value);
    setStatus("idle");
    setEditing(true);
  }

  async function save() {
    const next: Profile = { ...profile, [field]: draft };
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      // Checked, not assumed. A save that failed while the page showed the new
      // text would lose the writing on the next reload with nothing to warn you.
      if (!res.ok) throw new Error(String(res.status));
      onSaved(next);
      setEditing(false);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span style={{ fontSize: "14px", color: "var(--rf-text)" }}>{label}</span>

        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className="font-mono uppercase"
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.14em",
              color: "var(--rf-text-4)",
            }}
          >
            {status === "saved" ? COPY.saved : ""}
          </span>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-full transition-colors"
              style={{
                padding: "4px 12px",
                fontSize: "12px",
                color: "var(--rf-text-2)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              {value ? COPY.edit : COPY.add}
            </button>
          )}
        </div>
      </div>

      <p
        className="mb-[9px] mt-[3px]"
        style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
      >
        {note}
      </p>

      {editing ? (
        <>
          <textarea
            id={field}
            aria-label={label}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            placeholder={placeholder}
            className="w-full resize-none rounded-[4px] px-4 py-3 outline-none"
            style={{
              fontSize: "13.5px",
              lineHeight: 1.6,
              color: "var(--rf-text)",
              background: "var(--rf-surface)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          />

          {status === "failed" && (
            <Notice tone="error" className="mt-2">
              {COPY.saveError}
            </Notice>
          )}

          <div className="mt-[10px] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "7px 15px",
                fontSize: "12.5px",
                fontWeight: 500,
                background: "var(--rf-text)",
                color: "var(--rf-paper)",
              }}
            >
              {saving ? COPY.saving : COPY.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ fontSize: "12.5px", color: "var(--rf-text-3)" }}
            >
              {COPY.cancel}
            </button>
          </div>
        </>
      ) : value ? (
        // The person's own words, in the reading face rather than the input's.
        <p
          className="whitespace-pre-wrap"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            lineHeight: 1.7,
            color: "var(--rf-text)",
          }}
        >
          {value}
        </p>
      ) : (
        <p style={{ fontSize: "13px", color: "var(--rf-text-4)" }}>
          {COPY.unanswered}
        </p>
      )}
    </div>
  );
}

export function ProfileAnswers({
  fields,
  profile,
  onSaved,
}: {
  fields: {
    key: keyof Profile;
    label: string;
    note: string;
    placeholder: string;
  }[];
  profile: Profile;
  onSaved: (next: Profile) => void;
}) {
  return (
    <Sheet className="flex flex-col gap-[26px] px-7 py-7 sm:px-8">
      {fields.map((f) => (
        <ProfileAnswer
          key={f.key}
          field={f.key}
          label={f.label}
          note={f.note}
          placeholder={f.placeholder}
          profile={profile}
          onSaved={onSaved}
        />
      ))}
    </Sheet>
  );
}
