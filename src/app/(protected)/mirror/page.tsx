"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Kind = "fact" | "thread" | "preference" | "diagnostic_context" | "other";

type MemoryEntry = {
  id: string;
  kind: Kind;
  source: string;
  content: string;
  confirmed: boolean;
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const KINDS: { value: Kind; label: string; tag: string }[] = [
  { value: "fact", label: "Facts", tag: "Fact" },
  { value: "thread", label: "Open threads", tag: "Thread" },
  { value: "preference", label: "Preferences", tag: "Preference" },
  { value: "diagnostic_context", label: "Diagnostic context", tag: "Diagnostic" },
  { value: "other", label: "Other", tag: "Other" },
];

function kindTag(kind: Kind) {
  return KINDS.find((k) => k.value === kind)?.tag ?? kind;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onConfirm,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  onConfirm: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.trim() || draft.trim() === entry.content) { setEditing(false); return; }
    setSaving(true);
    await onEdit(entry.id, draft.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <li className="py-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(entry.content); }}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {/* Kind tag */}
        <span className="text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-medium">
          {kindTag(entry.kind)}
        </span>

        {/* Proposed badge */}
        {!entry.confirmed && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
            Proposed
          </span>
        )}

        <span className="text-stone-200">·</span>

        {/* Actions */}
        {!entry.confirmed && (
          <button
            onClick={() => onConfirm(entry.id)}
            className="text-xs text-green-600 hover:text-green-700 transition-colors"
          >
            Confirm
          </button>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Edit
          </button>
        )}
        {confirmDelete ? (
          <>
            <span className="text-xs text-stone-500">Remove?</span>
            <button
              onClick={() => onDelete(entry.id)}
              className="text-xs text-red-600 hover:text-red-700 transition-colors"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-stone-400 hover:text-red-600 transition-colors"
          >
            Delete
          </button>
        )}

        <span className="text-stone-200">·</span>
        <span className="text-xs text-stone-400">
          {entry.source === "user_added" ? "Added by you" : "From reflection"}
        </span>
      </div>
    </li>
  );
}

function AddEntryForm({
  defaultKind,
  onAdd,
}: {
  defaultKind: Kind;
  onAdd: (kind: Kind, content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(kind, content.trim());
    setContent("");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-stone-400 hover:text-stone-600 transition-colors mt-4"
      >
        + Add entry
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-center gap-3">
        <label htmlFor="add-kind" className="text-xs text-stone-500 shrink-0">Kind</label>
        <select
          id="add-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="text-xs text-stone-700 bg-white border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-300"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Enter memory…"
        autoFocus
        className="w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 leading-relaxed transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={saving || !content.trim()}
          className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
        >
          {saving ? "Adding…" : "Add"}
        </button>
        <button
          onClick={() => { setOpen(false); setContent(""); }}
          className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<Kind | "all">("all");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const fetchMemory = useCallback(async () => {
    const res = await fetch("/api/user/memory");
    if (res.ok) {
      const data = (await res.json()) as MemoryEntry[];
      // Sort most recent first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEntries(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  async function handleConfirm(id: string) {
    await fetch(`/api/user/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, confirmed: true } : e))
    );
  }

  async function handleEdit(id: string, content: string) {
    await fetch(`/api/user/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, content, confirmed: true } : e))
    );
  }

  async function handleDelete(id: string) {
    await fetch(`/api/user/memory/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleAdd(kind: Kind, content: string) {
    await fetch("/api/user/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content }),
    });
    await fetchMemory();
  }

  async function handleBulkDelete(kind?: Kind) {
    await fetch("/api/user/memory/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind ? { kind } : {}),
    });
    if (kind) {
      setEntries((prev) => prev.filter((e) => e.kind !== kind));
    } else {
      setEntries([]);
    }
    setConfirmBulkDelete(false);
    setConfirmDeleteAll(false);
  }

  const filtered = filterKind === "all"
    ? entries
    : entries.filter((e) => e.kind === filterKind);
  const proposed = filtered.filter((e) => !e.confirmed);
  const active = filtered.filter((e) => e.confirmed);
  const activeFilterLabel = filterKind !== "all"
    ? KINDS.find((k) => k.value === filterKind)?.label.toLowerCase()
    : null;

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Refine</h1>
        <nav className="flex items-center gap-4">
          <Link href="/reflections" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Reflections
          </Link>
          <span className="text-xs text-stone-700 font-medium underline underline-offset-4 decoration-stone-300">
            Mirror
          </span>
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <Link href="/" className="px-3 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-50 transition-colors">
            New reflection
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : (
          <>
            {/* Filter control */}
            <div className="flex items-center gap-3 mb-6">
              <label htmlFor="kind-filter" className="text-xs text-stone-400 shrink-0">Filter</label>
              <select
                id="kind-filter"
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value as Kind | "all")}
                className="text-xs text-stone-700 bg-white border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-300"
              >
                <option value="all">All ({entries.length})</option>
                {KINDS.map((k) => {
                  const count = entries.filter((e) => e.kind === k.value).length;
                  return (
                    <option key={k.value} value={k.value}>
                      {k.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Proposed — needs review */}
            {proposed.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Proposed — awaiting your review
                </h2>
                <ol className="divide-y divide-stone-100">
                  {proposed.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onConfirm={handleConfirm}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ol>
              </section>
            )}

            {/* Active entries */}
            <section>
              {proposed.length > 0 && (
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Active
                </h2>
              )}
              {active.length === 0 ? (
                <p className="text-sm text-stone-400">
                  {entries.length === 0
                    ? "Your reflections will start showing here as you build a practice."
                    : `No ${activeFilterLabel ?? "entries"} yet.`}
                </p>
              ) : (
                <ol className="divide-y divide-stone-100">
                  {active.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onConfirm={handleConfirm}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ol>
              )}
              <AddEntryForm
                defaultKind={filterKind !== "all" ? filterKind : "fact"}
                onAdd={handleAdd}
              />
            </section>

            {/* Bulk actions */}
            <section className="mt-10 pt-6 border-t border-stone-100 space-y-3">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
                Bulk actions
              </h2>
              {filterKind !== "all" && (
                confirmBulkDelete ? (
                  <p className="text-xs text-stone-500">
                    Delete all {activeFilterLabel}?{" "}
                    <button onClick={() => handleBulkDelete(filterKind as Kind)} className="text-red-600 hover:text-red-700 transition-colors">Delete</button>
                    {" · "}
                    <button onClick={() => setConfirmBulkDelete(false)} className="text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                  </p>
                ) : (
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="text-xs text-stone-400 hover:text-red-600 transition-colors"
                  >
                    Delete all {activeFilterLabel}
                  </button>
                )
              )}
              {confirmDeleteAll ? (
                <p className="text-xs text-stone-500">
                  Delete all memory? This cannot be undone.{" "}
                  <button onClick={() => handleBulkDelete()} className="text-red-600 hover:text-red-700 transition-colors">Delete all</button>
                  {" · "}
                  <button onClick={() => setConfirmDeleteAll(false)} className="text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                </p>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="block text-xs text-stone-400 hover:text-red-600 transition-colors"
                >
                  Delete all memory
                </button>
              )}
            </section>
          </>
        )}

        {/* Trash is a recovery affordance, not a destination — findable without
            adding a deletion concept to the main nav on every screen. */}
        <div className="mt-12 pt-6 border-t border-stone-100">
          <Link
            href="/trash"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            Trash
          </Link>
          <p className="mt-1 text-xs text-stone-400 leading-relaxed">
            Deleted reflections, kept for 30 days before they&apos;re permanently
            removed.
          </p>
        </div>
      </main>
    </div>
  );
}
