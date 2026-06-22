import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import SessionProvider from "@/components/SessionProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-slam-dark overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
