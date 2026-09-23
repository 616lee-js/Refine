import { redirect } from "next/navigation";

/**
 * The old standalone questionnaire screen, now a redirect.
 *
 * Questionnaires are read and edited in the archive's main view beside the
 * record rail, so this route would be a second place to do the same thing. The
 * link is kept rather than removed because it is live in the wild — Home's
 * launcher, bookmarks, and anything that captured a URL before the move.
 */
export default async function LegacyFrameworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  redirect(`/reflections/framework/${id}${edit === "1" ? "?edit=1" : ""}`);
}
