import { redirect } from "next/navigation";

/**
 * The old standalone check-in screen, now a redirect.
 *
 * Check-ins are read and edited in the archive's main view beside the record
 * rail, so this route would be a second place to do the same thing with a
 * second rail of its own. The link is kept rather than removed because it is
 * live in the wild — Home's launcher, bookmarks, and anything that captured a
 * URL before the move.
 *
 * `?edit=1` is carried through: pressing "Log" on Home means intending to fill
 * the check-in in, not to look at it.
 */
export default async function LegacyCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  redirect(`/reflections/checkin/${id}${edit === "1" ? "?edit=1" : ""}`);
}
