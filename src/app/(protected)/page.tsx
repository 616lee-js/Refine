import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Refine</h1>
        <p className="text-sm text-stone-500">Welcome back.</p>
      </div>
    </main>
  );
}
