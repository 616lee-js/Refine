import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { storedTimeZone } from "@/lib/time-zone";
import { FeedbackWidget } from "@/components/ui/feedback-widget";
import { TimeZoneSync } from "@/components/ui/time-zone-sync";

/**
 * Every authenticated page. The feedback widget is mounted here rather than per
 * page, so a new screen cannot ship without a way to report what is wrong with
 * it. `/admin/*` sits outside this route group and mounts its own copy in
 * src/app/admin/layout.tsx.
 */

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // The device reports its zone from here on every page; the server formats
  // every date in it. See lib/time.ts. Mounted in the layout for the same
  // reason the feedback widget is: a new screen cannot ship without it.
  const timeZone = await storedTimeZone(session.userId);

  return (
    <>
      {children}
      <TimeZoneSync current={timeZone} />
      <FeedbackWidget />
    </>
  );
}
