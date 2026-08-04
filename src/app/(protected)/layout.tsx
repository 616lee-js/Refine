import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FeedbackWidget } from "@/components/ui/feedback-widget";

/**
 * Every authenticated page. The feedback widget is mounted here rather than per
 * page, so a new screen cannot ship without a way to report what is wrong with
 * it. `/admin/*` sits outside this route group and deliberately does not get it.
 */

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return (
    <>
      {children}
      <FeedbackWidget />
    </>
  );
}
