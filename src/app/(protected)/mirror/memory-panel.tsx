"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";

/**
 * Mirror · Memory — the facts and threads Refine holds.
 *
 * ── Why the layout splits the way it does ─────────────────────────────────────
 * The design puts threads in the main column and facts in a narrow aside, and
 * that split is doing real work: a thread is a narrative sentence you read, a
 * fact is a short record you scan. Giving them the same weight makes both
 * harder to use.
 *
 * Our memory model has five kinds, not two, so the mapping is: `thread` runs
 * down the main column at reading size; everything else — facts, preferences,
 * diagnostic context, other — sits in the aside at scanning size, grouped.
 * Nothing is hidden behind a filter any more, which is what the old kind
 * dropdown was for.
 *
 * ── Proposed vs active ────────────────────────────────────────────────────────
 * Proposed entries sit in place among their own kind rather than in a separate
 * pile, marked and with a Confirm on them. The count is called out once at the
 * top of the aside. Extraction lands in Phase 6, so today every entry here is
 * one the user added themselves and nothing is ever proposed.
 */

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

const ASIDE_KINDS: { value: Exclude<Kind, "thread">; label: string }[] = [
  { value: "fact", label: "Facts" },
  { value: "preference", label: "Preferences" },
  { value: "diagnostic_context", label: "Diagnostic context" },
  { value: "other", label: "Other" },
];

const ALL_KINDS: { value: Kind; label: string }[] = [
  { value: "thread", label: "Open thread" },
  ...ASIDE_KINDS.map((k) => ({ value: k.value as Kind, label: k.label })),
];

function sourceLabel(entry: MemoryEntry): string {
  if (entry.source === "user_added") return "Added by you";
  if (!entry.confirmed) return "Caught by Refine";
  return "From your writing";
}

// ── Shared row affordances ────────────────────────────────────────────────────

function RowActions({
  entry,
  onConfirm,
  onStartEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  onConfirm: (id: string) => void;
  onStartEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const action = {
    fontFamily: "var(--font-mono)",
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--rf-text-3)",
  };

  return (
    <div className="flex shrink-0 items-center gap-3 pt-[3px]">
      {!entry.confirmed && (
        <button
          onClick={() => onConfirm(entry.id)}
          style={{ ...action, color: "var(--rf-accent-2)" }}
        >
          Keep
        </button>
      )}
      <button onClick={onStartEdit} style={action}>
        Edit
      </button>
      {confirmDelete ? (
        <>
          <button
            onClick={() => onDelete(entry.id)}
            style={{ ...action, color: "var(--color-error)" }}
          >
            Remove
          </button>
          <button onClick={() => setConfirmDelete(false)} style={action}>
            Cancel
          </button>
        </>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={action}>
          Remove
        </button>
      )}
    </div>
  );
}

function EditBox({
  value,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-[4px] px-3 py-2 outline-none"
        style={{
          fontSize: "13.5px",
          lineHeight: 1.6,
          color: "var(--rf-text)",
          background: "var(--rf-paper)",
          boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-full disabled:opacity-40"
          style={{
            padding: "6px 13px",
            fontSize: "12px",
            background: "var(--rf-text)",
            color: "var(--rf-paper)",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-3)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function ThreadRow({
  entry,
  onConfirm,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  onConfirm: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === entry.content) {
      setEditing(false);
      setDraft(entry.content);
      return;
    }
    setBusy(true);
    await onEdit(entry.id, next);
    setBusy(false);
    setEditing(false);
  }

  return (
    <li
      className="py-[13px]"
      style={{ borderTop: "1px solid var(--rf-rule)" }}
    >
      {editing ? (
        <EditBox
          value={draft}
          busy={busy}
          onChange={setDraft}
          onSave={save}
          onCancel={() => {
            setDraft(entry.content);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <p
              className="whitespace-pre-wrap"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "17px",
                lineHeight: 1.55,
                letterSpacing: "-0.012em",
                color: "var(--rf-text)",
                textWrap: "pretty",
              }}
            >
              {entry.content}
            </p>
            <RowActions
              entry={entry}
              onConfirm={onConfirm}
              onStartEdit={() => setEditing(true)}
              onDelete={onDelete}
            />
          </div>
          <div className="mt-[6px] flex items-center gap-[10px]">
            <Eyebrow size={9.5}>{sourceLabel(entry)}</Eyebrow>
            {!entry.confirmed && (
              <span
                className="rounded-full font-mono uppercase"
                style={{
                  padding: "2px 7px",
                  fontSize: "9px",
                  letterSpacing: "0.14em",
                  color: "var(--rf-accent)",
                  background: "var(--rf-accent-soft)",
                }}
              >
                Waiting on you
              </span>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function FactRow({
  entry,
  onConfirm,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  onConfirm: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === entry.content) {
      setEditing(false);
      setDraft(entry.content);
      return;
    }
    setBusy(true);
    await onEdit(entry.id, next);
    setBusy(false);
    setEditing(false);
  }

  return (
    <li className="py-[10px]" style={{ borderTop: "1px solid var(--rf-rule)" }}>
      {editing ? (
        <EditBox
          value={draft}
          busy={busy}
          onChange={setDraft}
          onSave={save}
          onCancel={() => {
            setDraft(entry.content);
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="whitespace-pre-wrap"
              style={{
                fontSize: "13px",
                lineHeight: 1.55,
                color: "var(--rf-text)",
              }}
            >
              {entry.content}
            </p>
            <div className="mt-[4px] flex flex-wrap items-center gap-[8px]">
              <Eyebrow size={9.5}>{sourceLabel(entry)}</Eyebrow>
              {!entry.confirmed && (
                <span
                  className="rounded-full font-mono uppercase"
                  style={{
                    padding: "2px 7px",
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    color: "var(--rf-accent)",
                    background: "var(--rf-accent-soft)",
                  }}
                >
                  Waiting
                </span>
              )}
            </div>
          </div>
          <RowActions
            entry={entry}
            onConfirm={onConfirm}
            onStartEdit={() => setEditing(true)}
            onDelete={onDelete}
          />
        </div>
      )}
    </li>
  );
}

// ── Add ───────────────────────────────────────────────────────────────────────

function AddEntry({
  defaultKind,
  label,
  onAdd,
}: {
  defaultKind: Kind;
  label: string;
  onAdd: (kind: Kind, content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!content.trim()) return;
    setBusy(true);
    await onAdd(kind, content.trim());
    setContent("");
    setBusy(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 font-mono uppercase"
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.14em",
          color: "var(--rf-text-3)",
        }}
      >
        + {label}
      </button>
    );
  }

  return (
    <div
      className="mt-3 flex flex-col gap-3 rounded-[4px] p-4"
      style={{ background: "var(--rf-surface)" }}
    >
      <div className="flex items-center gap-3">
        <label
          htmlFor={`kind-${defaultKind}`}
          className="shrink-0 font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-3)",
          }}
        >
          Kind
        </label>
        <select
          id={`kind-${defaultKind}`}
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="rounded-[4px] px-2 py-1 outline-none"
          style={{
            fontSize: "12px",
            color: "var(--rf-text)",
            background: "var(--rf-paper)",
            boxShadow: "inset 0 0 0 1px var(--rf-border)",
          }}
        >
          {ALL_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Something worth keeping"
        className="w-full resize-none rounded-[4px] px-3 py-2 outline-none"
        style={{
          fontSize: "13.5px",
          lineHeight: 1.6,
          color: "var(--rf-text)",
          background: "var(--rf-paper)",
          boxShadow: "inset 0 0 0 1px var(--rf-border)",
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={add}
          disabled={busy || !content.trim()}
          className="rounded-full disabled:opacity-40"
          style={{
            padding: "6px 13px",
            fontSize: "12px",
            background: "var(--rf-text)",
            color: "var(--rf-paper)",
          }}
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setContent("");
          }}
          className="font-mono uppercase"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            color: "var(--rf-text-3)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MemoryPanel() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState<Kind | "all" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/memory");
    if (res.ok) {
      const data = (await res.json()) as MemoryEntry[];
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setEntries(data);
    } else {
      setToast("Couldn't load your memory");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmEntry(id: string) {
    const res = await fetch(`/api/user/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    if (!res.ok) return setToast("Couldn't keep that one");
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, confirmed: true } : e))
    );
  }

  async function editEntry(id: string, content: string) {
    const res = await fetch(`/api/user/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return setToast("Couldn't save that change");
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, content, confirmed: true } : e))
    );
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/user/memory/${id}`, { method: "DELETE" });
    if (!res.ok) return setToast("Couldn't remove that one");
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function addEntry(kind: Kind, content: string) {
    const res = await fetch("/api/user/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content }),
    });
    if (!res.ok) return setToast("Couldn't add that");
    await load();
  }

  async function clear(kind?: Kind) {
    const res = await fetch("/api/user/memory/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind ? { kind } : {}),
    });
    if (!res.ok) {
      setConfirmClear(null);
      return setToast("Couldn't clear those");
    }
    setEntries((prev) => (kind ? prev.filter((e) => e.kind !== kind) : []));
    setConfirmClear(null);
  }

  const threads = entries.filter((e) => e.kind === "thread");
  const waiting = entries.filter((e) => !e.confirmed).length;

  const clearAction = {
    fontFamily: "var(--font-mono)",
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--rf-text-4)",
  };

  // A plain function, not a nested component: declaring a component inside the
  // render body gives it a new identity every render, which remounts its DOM on
  // each keystroke elsewhere on the page.
  function clearControl(kind: Kind | "all", label: string) {
    if (confirmClear === kind) {
      return (
        <span className="flex items-center gap-3">
          <button
            onClick={() => clear(kind === "all" ? undefined : kind)}
            style={{ ...clearAction, color: "var(--color-error)" }}
          >
            Confirm
          </button>
          <button onClick={() => setConfirmClear(null)} style={clearAction}>
            Cancel
          </button>
        </span>
      );
    }
    return (
      <button onClick={() => setConfirmClear(kind)} style={clearAction}>
        {label}
      </button>
    );
  }

  return (
    <>
          {loading ? (
            <p
              className="pt-8"
              style={{ fontSize: "13px", color: "var(--rf-text-4)" }}
            >
              Loading…
            </p>
          ) : (
            <div className="grid gap-x-10 gap-y-10 pt-[22px] lg:grid-cols-[1fr_320px]">
              {/* Threads — the reading column */}
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <Eyebrow>Threads · what keeps coming back</Eyebrow>
                  {threads.length > 0 && (
                    clearControl("thread", "Clear threads")
                  )}
                </div>

                {threads.length === 0 ? (
                  <Sheet className="mt-3 px-7 py-9">
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "16.5px",
                        lineHeight: 1.6,
                        color: "var(--rf-text-2)",
                        textWrap: "pretty",
                      }}
                    >
                      Nothing yet. Threads are the things that keep surfacing
                      across what you write — Refine will start proposing them
                      once there is enough writing to find them in.
                    </p>
                    <p
                      className="mt-[10px]"
                      style={{
                        fontSize: "12.5px",
                        lineHeight: 1.55,
                        color: "var(--rf-text-4)",
                      }}
                    >
                      You can also name one yourself. Nothing is kept that you
                      have not seen.
                    </p>
                  </Sheet>
                ) : (
                  <ol className="mt-2">
                    {threads.map((e) => (
                      <ThreadRow
                        key={e.id}
                        entry={e}
                        onConfirm={confirmEntry}
                        onEdit={editEntry}
                        onDelete={deleteEntry}
                      />
                    ))}
                  </ol>
                )}

                <AddEntry
                  defaultKind="thread"
                  label="Add a thread"
                  onAdd={addEntry}
                />
              </div>

              {/* Facts and the rest — the scanning column */}
              <aside className="lg:border-l lg:pl-7" style={{ borderColor: "var(--rf-border)" }}>
                {waiting > 0 && (
                  <div
                    className="rounded-[4px] px-4 py-[14px]"
                    style={{
                      background: "var(--rf-accent-soft)",
                      boxShadow: "inset 0 0 0 1px var(--rf-border)",
                    }}
                  >
                    <Eyebrow accent size={9.5}>
                      {waiting} waiting on you
                    </Eyebrow>
                    <p
                      className="mt-2"
                      style={{
                        fontSize: "12.5px",
                        lineHeight: 1.55,
                        color: "var(--rf-text-2)",
                      }}
                    >
                      Refine caught these but won&apos;t keep them until you say
                      so.
                    </p>
                  </div>
                )}

                {ASIDE_KINDS.map(({ value, label }) => {
                  const group = entries.filter((e) => e.kind === value);
                  // Empty non-fact groups stay out of the way entirely — four
                  // headers over four empty lists is noise, not structure.
                  if (group.length === 0 && value !== "fact") return null;
                  return (
                    <div key={value} className="mt-6 first:mt-0" style={waiting > 0 ? { marginTop: 22 } : undefined}>
                      <div className="flex items-baseline justify-between gap-4">
                        <Eyebrow>{label}</Eyebrow>
                        {group.length > 0 && (
                          clearControl(value, "Clear")
                        )}
                      </div>
                      {group.length === 0 ? (
                        <p
                          className="mt-2"
                          style={{
                            fontSize: "12.5px",
                            lineHeight: 1.55,
                            color: "var(--rf-text-4)",
                          }}
                        >
                          Nothing kept yet.
                        </p>
                      ) : (
                        <ol className="mt-2">
                          {group.map((e) => (
                            <FactRow
                              key={e.id}
                              entry={e}
                              onConfirm={confirmEntry}
                              onEdit={editEntry}
                              onDelete={deleteEntry}
                            />
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}

                <AddEntry
                  defaultKind="fact"
                  label="Add a fact"
                  onAdd={addEntry}
                />

                <div
                  className="mt-10 flex flex-col gap-3 pt-5"
                  style={{ borderTop: "1px solid var(--rf-rule)" }}
                >
                  {entries.length > 0 && (
                    clearControl("all", "Delete everything here")
                  )}
                  <div>
                    <Link
                      href="/trash"
                      className="font-mono uppercase"
                      style={{
                        fontSize: "9.5px",
                        letterSpacing: "0.14em",
                        color: "var(--rf-text-3)",
                      }}
                    >
                      Trash →
                    </Link>
                    <p
                      className="mt-[6px]"
                      style={{
                        fontSize: "11.5px",
                        lineHeight: 1.55,
                        color: "var(--rf-text-4)",
                      }}
                    >
                      What you&apos;ve deleted, kept for 30 days before it is
                      removed for good.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
