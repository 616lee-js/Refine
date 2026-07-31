"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Naming an entry, after the fact.
 *
 * The design put this on a completion screen that does not exist here — the
 * writing surface finishes straight to the archive on purpose, so that nothing
 * stands between putting something down and being done with it. Titling belongs
 * to re-reading instead: you rarely know what a piece of writing is called until
 * you have read it back.
 *
 * A title is optional and stays optional. The archive falls back to the date, so
 * an untitled entry is not a gap to be filled.
 */
export function EntryTitle({
  entryId,
  initialTitle,
  fallback,
}: {
  entryId: string;
  initialTitle: string | null;
  /** Shown when there is no title — the same date string the archive uses. */
  fallback: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle ?? "");
  const [saved, setSaved] = useState<string | null>(initialTitle);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    const next = value.trim();
    if (next === (saved ?? "")) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/reflections/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(next || null);
      setEditing(false);
      // The archive renders titles server-side, so it has to be told.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div>
        <input
          autoFocus
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(saved ?? "");
              setEditing(false);
            }
          }}
          onBlur={save}
          maxLength={120}
          placeholder="Give it a name"
          aria-label="Entry title"
          className="w-full bg-transparent outline-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "27px",
            fontWeight: 380,
            letterSpacing: "-0.02em",
            color: "var(--rf-text)",
            borderBottom: "1px solid var(--rf-border-strong)",
            paddingBottom: 2,
          }}
        />
        <p
          aria-live="polite"
          className="mt-[6px] font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: failed ? "var(--color-error)" : "var(--rf-text-4)",
          }}
        >
          {failed
            ? "Couldn't save that name"
            : busy
              ? "Saving…"
              : "Enter to keep · Esc to cancel"}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group block max-w-full text-left"
      title={saved ? "Rename" : "Give this a name"}
    >
      <span
        className="block truncate"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "27px",
          fontWeight: 380,
          letterSpacing: "-0.02em",
          color: saved ? "var(--rf-text)" : "var(--rf-text-2)",
          borderBottom: "1px solid transparent",
        }}
      >
        {saved ?? fallback}
      </span>
      <span
        className="mt-[6px] block font-mono uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.14em",
          color: "var(--rf-text-4)",
        }}
      >
        {saved ? "Rename" : "Give this a name"}
      </span>
    </button>
  );
}
