"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { Notice } from "@/components/ui/notice";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import type { InviteRow } from "@/lib/auth/invite-admin";

/**
 * A reset code as the route returns it.
 *
 * Dates arrive already formatted and as ISO strings rather than `Date` objects —
 * JSON has no dates, and formatting one in this component would render differently
 * on the server than at hydration. See the route.
 */
type ResetListRow = {
  id: string;
  note: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdLabel: string;
  expiresLabel: string;
};

/**
 * Issuing and revoking the two kinds of code.
 *
 * ── A generated code is shown once ────────────────────────────────────────────
 * Reset codes are stored hashed, so what the server returns here is the only
 * copy that will ever exist outside the person it is handed to. It stays on
 * screen until dismissed rather than in a toast that disappears — a code lost to
 * a timeout means issuing another one.
 *
 * ── Looking up reset codes needs the address typed ────────────────────────────
 * There is no list of accounts and no account browser. An admin who wants to know
 * about an account types its address, which is how `npm run invites -- whoami`
 * already works. Building a list of every account's email into an admin page is a
 * larger exposure than this job needs.
 */

// COPY REVIEW: this is an admin screen, so the wording is operational rather than
// product voice. Still placeholders.
const COPY = {
  invitesTitle: "[COPY] Invite codes",
  invitesNote:
    "[COPY] The only way to create an account. Generate one, hand it over, and it works once.",
  howMany: "[COPY] How many",
  expiry: "[COPY] Expires after",
  expiryNever: "[COPY] Never",
  expiryDays: (n: number) => `[COPY] ${n} days`,
  noteLabel: "[COPY] Note — for your records only",
  notePlaceholder: "[COPY] e.g. for Sam, sent 1 Oct",
  generate: "[COPY] Generate",
  generating: "[COPY] Generating…",
  generatedInvites: "[COPY] Copy these now. They are listed below as well.",

  resetsTitle: "[COPY] Password reset codes",
  resetsNote:
    "[COPY] Refine cannot send email, so a reset is a code you issue and hand over. It works once, for one account, and expires.",
  emailLabel: "[COPY] Account email address",
  emailPlaceholder: "[COPY] someone@example.com",
  issue: "[COPY] Issue reset code",
  issuing: "[COPY] Issuing…",
  resetIssued: (hours: number) =>
    `[COPY] Shown once — it is stored hashed and cannot be read again. Valid for ${hours} hours.`,
  noSuchAccount: "[COPY] No account has that email address.",
  replacedNote:
    "[COPY] Any reset code already outstanding for this account has been revoked.",

  lookupLabel: "[COPY] Show codes for an account",
  lookup: "[COPY] Show",
  lookingUp: "[COPY] Looking…",

  revoke: "[COPY] Revoke",
  revoking: "[COPY] Revoking…",
  revokeCodeLabel: "[COPY] Revoke an invite code",
  revoked: "[COPY] Revoked.",
  notRevoked: "[COPY] Nothing to revoke — that code does not exist, or it was already used.",

  dismiss: "[COPY] Done",
  failed: "[COPY] That didn't work. Nothing was changed.",

  statusUsed: "[COPY] Used",
  statusRevoked: "[COPY] Revoked",
  statusExpired: "[COPY] Expired",
  statusLive: "[COPY] Live",
  none: "[COPY] None yet.",
  neverExpires: "[COPY] No expiry",
} as const;

const EXPIRY_CHOICES: (number | null)[] = [null, 7, 30, 90];

type Status = "used" | "revoked" | "expired" | "live";

function statusOf(row: {
  usedAt: Date | string | null;
  revokedAt: Date | string | null;
  expiresAt: Date | string | null;
}): Status {
  if (row.usedAt) return "used";
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return "expired";
  return "live";
}

const STATUS_LABEL: Record<Status, string> = {
  used: COPY.statusUsed,
  revoked: COPY.statusRevoked,
  expired: COPY.statusExpired,
  live: COPY.statusLive,
};

function StatusTag({ status }: { status: Status }) {
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: "9px",
        letterSpacing: "0.12em",
        color: status === "live" ? "var(--rf-accent)" : "var(--rf-text-4)",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Dates are pre-formatted on the server — see the page. */
type FormattedInvite = InviteRow & { createdLabel: string; expiresLabel: string };

export function AccessControls({
  invites,
}: {
  invites: FormattedInvite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Invite generation
  const [count, setCount] = useState(1);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [inviteNote, setInviteNote] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  // Invite revoke
  const [revokeCode, setRevokeCode] = useState("");
  const [revokeResult, setRevokeResult] = useState<boolean | null>(null);

  // Reset codes
  const [email, setEmail] = useState("");
  const [resetNote, setResetNote] = useState("");
  const [issued, setIssued] = useState<{ code: string; hours: number } | null>(
    null
  );
  const [noAccount, setNoAccount] = useState(false);
  const [resets, setResets] = useState<ResetListRow[] | null>(null);

  async function call(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Record<string, unknown>;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setNewCodes(null);
    const data = await call(
      {
        action: "invite_create",
        count,
        expiresDays: expiryDays,
        note: inviteNote || null,
      },
      "generate"
    );
    if (!data) return;
    setNewCodes((data.codes as string[]) ?? []);
    setInviteNote("");
    router.refresh();
  }

  async function doRevokeInvite() {
    setRevokeResult(null);
    const data = await call(
      { action: "invite_revoke", code: revokeCode },
      "revoke-invite"
    );
    if (!data) return;
    setRevokeResult(Boolean(data.revoked));
    setRevokeCode("");
    router.refresh();
  }

  async function issueReset() {
    setIssued(null);
    setNoAccount(false);
    const data = await call(
      { action: "reset_create", email, note: resetNote || null },
      "issue"
    );
    if (!data) return;
    if (!data.found) {
      setNoAccount(true);
      return;
    }
    setIssued({ code: data.code as string, hours: data.hours as number });
    setResetNote("");
    // Issuing revoked anything outstanding, so a list already on screen is now
    // wrong. Re-read it rather than patching it.
    if (resets) await loadResets();
  }

  async function loadResets() {
    setNoAccount(false);
    const data = await call({ action: "reset_list", email }, "lookup");
    if (!data) return;
    if (!data.found) {
      setResets(null);
      setNoAccount(true);
      return;
    }
    setResets((data.rows as ResetListRow[]) ?? []);
  }

  async function revokeReset(id: string) {
    const data = await call({ action: "reset_revoke", id }, `revoke-${id}`);
    if (!data) return;
    // Re-read rather than editing the row here: the server decides what a revoke
    // did, and a locally patched row would claim success the server never gave.
    await loadResets();
  }

  return (
    <div className="flex flex-col gap-7">
      {failed && <Notice tone="error">{COPY.failed}</Notice>}

      {/* ── Invite codes ───────────────────────────────────────────────────── */}
      <CollapsibleSection title={COPY.invitesTitle} note={COPY.invitesNote}>
        <Sheet className="px-6 py-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.howMany}</Eyebrow>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="rf-input"
                style={{ width: 72 }}
              />
            </label>

            <label className="flex flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.expiry}</Eyebrow>
              <select
                value={expiryDays === null ? "never" : String(expiryDays)}
                onChange={(e) =>
                  setExpiryDays(
                    e.target.value === "never" ? null : Number(e.target.value)
                  )
                }
                className="rf-input"
              >
                {EXPIRY_CHOICES.map((d) => (
                  <option key={d ?? "never"} value={d === null ? "never" : String(d)}>
                    {d === null ? COPY.expiryNever : COPY.expiryDays(d)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[220px] flex-1 flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.noteLabel}</Eyebrow>
              <input
                type="text"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder={COPY.notePlaceholder}
                className="rf-input"
              />
            </label>

            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy !== null}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "8px 16px",
                fontSize: "12.5px",
                fontWeight: 500,
                background: "var(--rf-text)",
                color: "var(--rf-paper)",
              }}
            >
              {busy === "generate" ? COPY.generating : COPY.generate}
            </button>
          </div>

          {newCodes && newCodes.length > 0 && (
            <div className="mt-4">
              <Notice tone="quiet">{COPY.generatedInvites}</Notice>
              <ul className="mt-2 flex flex-col gap-1">
                {newCodes.map((c) => (
                  <li
                    key={c}
                    className="font-mono"
                    style={{ fontSize: "14px", color: "var(--rf-text)" }}
                  >
                    {c}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setNewCodes(null)}
                className="mt-2"
                style={{ fontSize: "12px", color: "var(--rf-text-3)" }}
              >
                {COPY.dismiss}
              </button>
            </div>
          )}

          <div
            className="my-5"
            style={{ height: 1, background: "var(--rf-rule)" }}
          />

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[200px] flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.revokeCodeLabel}</Eyebrow>
              <input
                type="text"
                value={revokeCode}
                onChange={(e) => setRevokeCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className="rf-input-mono"
              />
            </label>
            <button
              type="button"
              onClick={() => void doRevokeInvite()}
              disabled={busy !== null || !revokeCode.trim()}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "7px 14px",
                fontSize: "12.5px",
                color: "var(--rf-text-2)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
            >
              {busy === "revoke-invite" ? COPY.revoking : COPY.revoke}
            </button>
            {revokeResult !== null && (
              <span style={{ fontSize: "12px", color: "var(--rf-text-3)" }}>
                {revokeResult ? COPY.revoked : COPY.notRevoked}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {invites.length === 0 ? (
              <p style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}>
                {COPY.none}
              </p>
            ) : (
              invites.map((row) => {
                const status = statusOf(row);
                return (
                  <div
                    key={row.code}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
                    style={{
                      paddingBottom: 6,
                      borderBottom: "1px solid var(--rf-rule)",
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{ fontSize: "12.5px", color: "var(--rf-text)" }}
                    >
                      {row.code}
                    </span>
                    <StatusTag status={status} />
                    <span style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}>
                      {row.createdLabel} · {row.expiresLabel}
                    </span>
                    {row.note && (
                      <span
                        style={{ fontSize: "11.5px", color: "var(--rf-text-3)" }}
                      >
                        {row.note}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Sheet>
      </CollapsibleSection>

      {/* ── Reset codes ────────────────────────────────────────────────────── */}
      <CollapsibleSection title={COPY.resetsTitle} note={COPY.resetsNote}>
        <Sheet className="px-6 py-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[240px] flex-1 flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.emailLabel}</Eyebrow>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={COPY.emailPlaceholder}
                className="rf-input"
              />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-[5px]">
              <Eyebrow size={9}>{COPY.noteLabel}</Eyebrow>
              <input
                type="text"
                value={resetNote}
                onChange={(e) => setResetNote(e.target.value)}
                className="rf-input"
              />
            </label>
            <button
              type="button"
              onClick={() => void issueReset()}
              disabled={busy !== null || !email.trim()}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "8px 16px",
                fontSize: "12.5px",
                fontWeight: 500,
                background: "var(--rf-text)",
                color: "var(--rf-paper)",
              }}
            >
              {busy === "issue" ? COPY.issuing : COPY.issue}
            </button>
            <button
              type="button"
              onClick={() => void loadResets()}
              disabled={busy !== null || !email.trim()}
              className="rounded-full transition-colors disabled:opacity-40"
              style={{
                padding: "7px 14px",
                fontSize: "12.5px",
                color: "var(--rf-text-2)",
                boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
              }}
              aria-label={COPY.lookupLabel}
            >
              {busy === "lookup" ? COPY.lookingUp : COPY.lookup}
            </button>
          </div>

          {noAccount && (
            <div className="mt-4">
              <Notice tone="warn">{COPY.noSuchAccount}</Notice>
            </div>
          )}

          {issued && (
            <div className="mt-4">
              <Notice tone="quiet">{COPY.resetIssued(issued.hours)}</Notice>
              <p
                className="mt-2 font-mono"
                style={{ fontSize: "18px", color: "var(--rf-text)" }}
              >
                {issued.code}
              </p>
              <p
                className="mt-1"
                style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
              >
                {COPY.replacedNote}
              </p>
              <button
                type="button"
                onClick={() => setIssued(null)}
                className="mt-2"
                style={{ fontSize: "12px", color: "var(--rf-text-3)" }}
              >
                {COPY.dismiss}
              </button>
            </div>
          )}

          {resets && (
            <div className="mt-5 flex flex-col gap-2">
              {resets.length === 0 ? (
                <p style={{ fontSize: "12.5px", color: "var(--rf-text-4)" }}>
                  {COPY.none}
                </p>
              ) : (
                resets.map((row) => {
                  const status = statusOf(row);
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
                      style={{
                        paddingBottom: 6,
                        borderBottom: "1px solid var(--rf-rule)",
                      }}
                    >
                      <StatusTag status={status} />
                      <span
                        style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}
                      >
                        {row.createdLabel} · {row.expiresLabel}
                      </span>
                      {row.note && (
                        <span
                          style={{ fontSize: "11.5px", color: "var(--rf-text-3)" }}
                        >
                          {row.note}
                        </span>
                      )}
                      {status === "live" && (
                        <button
                          type="button"
                          onClick={() => void revokeReset(row.id)}
                          disabled={busy !== null}
                          style={{
                            fontSize: "11.5px",
                            color: "var(--color-error)",
                          }}
                        >
                          {COPY.revoke}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Sheet>
      </CollapsibleSection>
    </div>
  );
}
