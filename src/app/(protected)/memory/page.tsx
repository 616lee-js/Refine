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

const KINDS: { value: Kind; label: string }[] = [
  { value: "fact", label: "Facts" },
  { value: "thread", label: "Open threads" },
  { value: "preference", label: "Preferences" },
  { value: "diagnostic_context", label: "Diagnostic context" },
  { value: "other", label: "Other" },
];

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
    <li className="py-3 space-y-2">
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
            <span className="text-xs text-stone-500">Remove this entry?</span>
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
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-400">
          {entry.source === "user_added" ? "Added by you" : "From reflection"}
        </span>
      </div>
    </li>
  );
}

function AddEntryForm({
  kind,
  onAdd,
}: {
  kind: Kind;
  onAdd: (kind: Kind, content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
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
        className="text-xs text-stone-400 hover:text-stone-600 transition-colors mt-2"
      >
        + Add entry
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Enter memory…"
        autoFocus
        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white leading-relaxed transition-colors"
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
  const [activeTab, setActiveTab] = useState<Kind>("fact");
  const [confirmBulkKind, setConfirmBulkKind] = useState<Kind | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const fetchMemory = useCallback(async () => {
    const res = await fetch("/api/user/memory");
    if (res.ok) setEntries(await res.json());
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
    setConfirmBulkKind(null);
    setConfirmDeleteAll(false);
  }

  const proposed = entries.filter((e) => !e.confirmed);
  const active = entries.filter((e) => e.confirmed);
  const activeForTab = active.filter((e) => e.kind === activeTab);
  const proposedForTab = proposed.filter((e) => e.kind === activeTab);

  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h1 className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
          Refine — Memory
        </h1>
        <div className="flex items-center gap-4">
          <Link href="/settings/profile" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Profile
          </Link>
          <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            ← Home
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto">
        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : (
          <>
            {/* Kind tabs */}
            <div className="flex gap-1 mb-6 flex-wrap">
              {KINDS.map(({ value, label }) => {
                const count = entries.filter((e) => e.kind === value).length;
                return (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === value
                        ? "bg-stone-800 text-white"
                        : "text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    {label}{count > 0 ? ` (${count})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Proposed section */}
            {proposedForTab.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                  Proposed — awaiting your review
                </h2>
                <ol className="divide-y divide-stone-100">
                  {proposedForTab.map((e) => (
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

            {/* Active section */}
            <section>
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                Active
              </h2>
              {activeForTab.length === 0 ? (
                <p className="text-sm text-stone-400">No {KINDS.find((k) => k.value === activeTab)?.label.toLowerCase()} yet.</p>
              ) : (
                <ol className="divide-y divide-stone-100">
                  {activeForTab.map((e) => (
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
              <AddEntryForm kind={activeTab} onAdd={handleAdd} />
            </section>

            {/* Bulk actions */}
            <section className="mt-10 pt-6 border-t border-stone-100 space-y-3">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
                Bulk actions
              </h2>
              {confirmBulkKind ? (
                <p className="text-xs text-stone-500">
                  Delete all {KINDS.find((k) => k.value === confirmBulkKind)?.label.toLowerCase()}?{" "}
                  <button onClick={() => handleBulkDelete(confirmBulkKind)} className="text-red-600 hover:text-red-700 transition-colors">Delete</button>
                  {" · "}
                  <button onClick={() => setConfirmBulkKind(null)} className="text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                </p>
              ) : (
                <button
                  onClick={() => setConfirmBulkKind(activeTab)}
                  className="text-xs text-stone-400 hover:text-red-600 transition-colors"
                >
                  Delete all {KINDS.find((k) => k.value === activeTab)?.label.toLowerCase()}
                </button>
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
      </main>
    </div>
  );
}
