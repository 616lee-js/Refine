"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/journal/categories";

/**
 * The categories on one entry, and the control to change them.
 *
 * ── Theirs ────────────────────────────────────────────────────────────────────
 * Every name here was typed by the person. Refine suggests nothing: the picker
 * lists what they already have and lets them make a new one. Owner's decision,
 * 2026-11-11.
 *
 * ── One control, three places ─────────────────────────────────────────────────
 * The entry's header when reading it back, the editor, and the entry's card in
 * Reflections (`compact`). Same component, same requests, so a change made in
 * one place is what the other two show after the refresh.
 *
 * ── Manage ────────────────────────────────────────────────────────────────────
 * Inside the picker, "Manage" turns each row into rename / delete. Deleting a
 * category removes it from every entry; the entries are untouched.
 */

// COPY REVIEW: the category control, in full.
const COPY = {
  add: "[COPY] + Category",
  addCompact: "[COPY] +",
  placeholder: "[COPY] Find or create…",
  create: (name: string) => `[COPY] Create "${name}"`,
  none: "[COPY] No categories yet — type one above.",
  noMatch: "[COPY] Nothing matches.",
  manage: "[COPY] Manage",
  done: "[COPY] Done",
  rename: "[COPY] Rename",
  delete: "[COPY] Delete",
  confirmDelete: (name: string) =>
    `[COPY] Delete "${name}"? It comes off every entry. The entries stay.`,
  remove: (name: string) => `[COPY] Remove ${name}`,
  saveError: "[COPY] That didn't save — try again.",
  nameClash: "[COPY] Another category already has that name.",
} as const;

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function EntryCategories({
  entryId,
  initial,
  all: initialAll,
  compact = false,
}: {
  entryId: string;
  /** On this entry now. */
  initial: Category[];
  /** Every category the person has. */
  all: Category[];
  /** Smaller labels, for a card. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Category[]>(initial);
  const [all, setAll] = useState<Category[]>(initialAll);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manage, setManage] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Sends the whole set. Reverts on failure so the screen never lies. */
  async function commit(next: Category[]) {
    const before = selected;
    setSelected(next);
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/reflections/${entryId}/categories`, "PUT", {
        categoryIds: next.map((c) => c.id),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setSelected(before);
      setError(COPY.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function create(name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await send("/api/user/categories", "POST", { name });
      if (!res.ok) throw new Error(String(res.status));
      const made = (await res.json()) as Category;
      setAll((prev) => (prev.some((c) => c.id === made.id) ? prev : [...prev, made]));
      setQuery("");
      await commit(selected.some((c) => c.id === made.id) ? selected : [...selected, made]);
    } catch {
      setError(COPY.saveError);
      setBusy(false);
    }
  }

  async function rename(id: string, name: string) {
    const clean = name.replace(/\s+/g, " ").trim();
    const current = all.find((c) => c.id === id);
    if (!clean || !current || clean === current.name) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/user/categories/${id}`, "PATCH", { name: clean });
      if (res.status === 409) {
        setError(COPY.nameClash);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const apply = (c: Category) => (c.id === id ? { ...c, name: clean } : c);
      setAll((prev) => prev.map(apply));
      setSelected((prev) => prev.map(apply));
      setRenaming(null);
      router.refresh();
    } catch {
      setError(COPY.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const target = all.find((c) => c.id === id);
    if (!target || !window.confirm(COPY.confirmDelete(target.name))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/user/categories/${id}`, "DELETE");
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setAll((prev) => prev.filter((c) => c.id !== id));
      setSelected((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch {
      setError(COPY.saveError);
    } finally {
      setBusy(false);
    }
  }

  const q = query.replace(/\s+/g, " ").trim();
  const qLower = q.toLowerCase();
  const selectedIds = new Set(selected.map((c) => c.id));
  const candidates = all
    .filter((c) => !selectedIds.has(c.id))
    .filter((c) => !qLower || c.name.toLowerCase().includes(qLower))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = q ? all.some((c) => c.name.toLowerCase() === qLower) : true;

  const labelStyle: React.CSSProperties = {
    padding: compact ? "2px 8px" : "4px 10px",
    fontSize: compact ? "11px" : "12px",
    color: "var(--rf-text-2)",
    background: "var(--rf-accent-soft)",
  };

  return (
    <div ref={root} className="relative" style={{ opacity: busy ? 0.7 : 1 }}>
      <div className="flex flex-wrap items-center gap-[6px]">
        {selected.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-[5px] rounded-full"
            style={labelStyle}
          >
            {c.name}
            <button
              type="button"
              aria-label={COPY.remove(c.name)}
              disabled={busy}
              onClick={() => void commit(selected.filter((s) => s.id !== c.id))}
              className="transition-opacity hover:opacity-60"
              style={{ color: "var(--rf-text-3)", lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setManage(false);
            setRenaming(null);
          }}
          aria-expanded={open}
          disabled={busy}
          className="rounded-full transition-colors"
          style={{
            padding: compact ? "2px 8px" : "4px 10px",
            fontSize: compact ? "11px" : "12px",
            color: "var(--rf-text-3)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        >
          {compact ? COPY.addCompact : COPY.add}
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 z-20 mt-1 flex w-[260px] flex-col rounded-[6px] p-2"
          style={{
            background: "var(--rf-paper)",
            boxShadow: "inset 0 0 0 1px var(--rf-border-strong), 0 6px 20px rgba(0,0,0,0.08)",
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (candidates.length === 1 && exact) void commit([...selected, candidates[0]]);
              else if (q && !exact) void create(q);
            }}
            placeholder={COPY.placeholder}
            maxLength={40}
            className="w-full rounded-[4px] px-2 py-[5px] outline-none"
            style={{
              fontSize: "12px",
              color: "var(--rf-text)",
              background: "var(--rf-surface)",
              boxShadow: "inset 0 0 0 1px var(--rf-border)",
            }}
          />

          <div className="mt-1 flex max-h-[220px] flex-col overflow-y-auto">
            {q && !exact && (
              <button
                type="button"
                onClick={() => void create(q)}
                className="rounded-[4px] px-2 py-[6px] text-left transition-colors hover:opacity-70"
                style={{ fontSize: "12px", color: "var(--rf-accent)" }}
              >
                {COPY.create(q)}
              </button>
            )}
            {candidates.map((c) =>
              manage ? (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-[5px]"
                  style={{ fontSize: "12px", color: "var(--rf-text-2)" }}
                >
                  {renaming?.id === c.id ? (
                    <input
                      autoFocus
                      value={renaming.name}
                      maxLength={40}
                      onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void rename(c.id, renaming.name);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onBlur={() => void rename(c.id, renaming.name)}
                      className="min-w-0 flex-1 rounded-[4px] px-2 py-[3px] outline-none"
                      style={{
                        fontSize: "12px",
                        background: "var(--rf-surface)",
                        boxShadow: "inset 0 0 0 1px var(--rf-border)",
                      }}
                    />
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => setRenaming({ id: c.id, name: c.name })}
                        className="shrink-0 hover:opacity-70"
                        style={{ fontSize: "11px", color: "var(--rf-text-3)" }}
                      >
                        {COPY.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(c.id)}
                        className="shrink-0 hover:opacity-70"
                        style={{ fontSize: "11px", color: "var(--color-error)" }}
                      >
                        {COPY.delete}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void commit([...selected, c])}
                  className="rounded-[4px] px-2 py-[6px] text-left transition-colors hover:opacity-70"
                  style={{ fontSize: "12px", color: "var(--rf-text-2)" }}
                >
                  {c.name}
                </button>
              )
            )}
            {all.length === 0 && !q && (
              <p className="px-2 py-[6px]" style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}>
                {COPY.none}
              </p>
            )}
            {all.length > 0 && candidates.length === 0 && exact && (
              <p className="px-2 py-[6px]" style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}>
                {COPY.noMatch}
              </p>
            )}
          </div>

          {all.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setManage((v) => !v);
                setRenaming(null);
              }}
              className="mt-1 self-end px-2 py-[4px] hover:opacity-70"
              style={{ fontSize: "11px", color: "var(--rf-text-4)" }}
            >
              {manage ? COPY.done : COPY.manage}
            </button>
          )}
        </div>
      )}

      {error && (
        <p aria-live="polite" className="mt-1" style={{ fontSize: "11.5px", color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
