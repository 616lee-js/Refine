"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Starting a new record — a written entry, a check-in, or a questionnaire.
 *
 * ── Why this is shared ────────────────────────────────────────────────────────
 * Two screens offer these now: Home and the archive's record panel. The three
 * create calls, and more importantly where each one lands afterwards, were
 * written once on Home. Copied, they would drift — and the way they drift is
 * silent, because a record still gets created and the only symptom is landing on
 * the wrong screen or arriving read-only.
 *
 * ── `?edit=1` is the part worth protecting ────────────────────────────────────
 * A questionnaire opens inside the archive, and an already-completed response
 * opens read-only there. That is right when arriving from the record list and
 * wrong when the person just pressed a button meaning "fill this in", so
 * everything started here carries `?edit=1`.
 *
 * ── Wording stays with the caller ─────────────────────────────────────────────
 * This returns `failed` as a boolean rather than a message. Home and the panel
 * have their own voice and their own `[COPY]` blocks, and a shared string would
 * have to suit both.
 */

export type StartKind = "entry" | "framework" | "checkin";

export function useStartRecord() {
  const router = useRouter();
  const [starting, setStarting] = useState<StartKind | null>(null);
  const [failed, setFailed] = useState(false);

  async function start(kind: StartKind, slug?: string) {
    setStarting(kind);
    setFailed(false);
    try {
      const res =
        kind === "entry"
          ? await fetch("/api/reflections", { method: "POST" })
          : await fetch("/api/questionnaires", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug }),
            });
      // Checked rather than assumed: a failed create that still navigated would
      // land on a record id of `undefined`.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        reflectionId?: string;
        responseId?: string;
      };

      // Only the writing surface is a screen of its own. Linked straight to the
      // archive routes rather than through /checkin/[id] and /framework/[id],
      // which redirect there — correct, but a wasted hop.
      if (kind === "entry") router.push(`/reflection/${data.reflectionId}`);
      else if (kind === "checkin")
        router.push(`/reflections/checkin/${data.responseId}?edit=1`);
      else router.push(`/reflections/framework/${data.responseId}?edit=1`);
    } catch {
      setFailed(true);
      setStarting(null);
    }
  }

  return { start, starting, failed };
}
