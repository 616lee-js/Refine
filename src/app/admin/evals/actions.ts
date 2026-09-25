"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { reportEvaluations, summaryEvaluations } from "@/lib/db/schema";
import {
  EVAL_SNAPSHOTS_ENABLED,
  setBooleanSetting,
} from "@/lib/settings";

/**
 * The two controls on the evaluations page.
 *
 * Each gates itself. A server action is an independently addressable endpoint
 * and does not render through the page or the layout, so a check on either of
 * those protects nothing here.
 */

const PATH = "/admin/evals";

/**
 * Turns snapshot capture on or off, for both kinds of assessment.
 *
 * One switch by decision (2026-09-25). Worth knowing which way it cuts: with it
 * off, a summary assessment can still be understood later by re-reading the
 * entry, but a report assessment cannot — a report is deletable from Mirror,
 * and once it is gone there is nothing left to re-read.
 */
export async function setCapture(formData: FormData) {
  await requireAdmin();

  const next = formData.get("next");
  if (next !== "on" && next !== "off") return;

  await setBooleanSetting(EVAL_SNAPSHOTS_ENABLED, next === "on");
  revalidatePath(PATH);
}

/**
 * Destroys stored copies. Permanent, with no recovery path by design.
 *
 * The rubric, the rating and the version survive in every case — the same shape
 * as purging an entry: the content goes, the record that it existed stays.
 * `snapshots_cleared_at` is what distinguishes destroyed from never captured.
 */
export async function clearSnapshots(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id");
  const kind = formData.get("kind");
  const scope = formData.get("scope");
  const now = new Date();

  const summaryCleared = {
    encryptedEntrySnapshot: null,
    encryptedSummarySnapshot: null,
    encryptedNotes: null,
    snapshotsClearedAt: now,
  };
  const reportCleared = {
    encryptedReportSnapshot: null,
    encryptedNotes: null,
    snapshotsClearedAt: now,
  };

  if (scope === "all") {
    // Both tables. "All stored content" has to mean all of it, or the button
    // is a lie the next time someone reads the page.
    await db.update(summaryEvaluations).set(summaryCleared);
    await db.update(reportEvaluations).set(reportCleared);
  } else if (typeof id === "string" && id && kind === "summary") {
    await db
      .update(summaryEvaluations)
      .set(summaryCleared)
      .where(eq(summaryEvaluations.id, id));
  } else if (typeof id === "string" && id && kind === "report") {
    await db
      .update(reportEvaluations)
      .set(reportCleared)
      .where(eq(reportEvaluations.id, id));
  } else {
    return;
  }

  revalidatePath(PATH);
}
