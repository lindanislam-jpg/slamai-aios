import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer, getAdmin } from "@/remit/server/auth";
import { BottomNav, SideNav } from "@/components/remit/AppNav";
import { SandboxBadge, Wordmark } from "@/components/remit/ui";
import SessionProvider from "@/components/SessionProvider";

export const dynamic = "force-dynamic";

/**
 * Customer application shell.
 *
 * Auth is checked here rather than in each page, so a new page cannot be added
 * without protection by accident.
 */
export default async function SendAppLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (!customer) redirect("/send/login");

  const admin = await getAdmin();

  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-send-canvas">
        <header className="sticky top-0 z-30 border-b border-send-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
            <Wordmark />
            <div className="flex items-center gap-2.5">
              {customer.isDemo && <SandboxBadge />}
              {admin && (
                <Link
                  href="/send/admin"
                  className="rounded-lg border border-send-line px-3 py-1.5 text-[12px] font-bold text-send-body hover:border-send-primary hover:text-send-primary"
                >
                  Admin
                </Link>
              )}
              <span className="hidden text-[13px] font-semibold text-send-body sm:inline">
                {customer.fullName.split(" ")[0]}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-5 py-6 lg:py-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24">
              <SideNav />
            </div>
          </aside>

          {/* Bottom padding clears the fixed mobile nav. */}
          <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
        </div>

        <BottomNav />
      </div>
    </SessionProvider>
  );
}
