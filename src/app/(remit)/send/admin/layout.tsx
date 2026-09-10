import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/remit/server/auth";
import { AdminNav } from "@/components/remit/AdminNav";
import { SandboxBadge, Wordmark } from "@/components/remit/ui";
import SessionProvider from "@/components/SessionProvider";

export const dynamic = "force-dynamic";

/**
 * Admin shell.
 *
 * Admin access is a row in `remit_admins` with explicit permissions, not a flag
 * on the user. Checking it here means an admin page cannot be added without
 * protection, and individual pages still check the specific permission they
 * need.
 */
export default async function SendAdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getAdmin();
  if (!context) redirect("/send/login");

  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-send-canvas">
        <header className="sticky top-0 z-30 border-b border-send-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-3">
              <Wordmark />
              <span className="rounded-lg bg-send-ink px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-3">
              <SandboxBadge />
              <Link
                href="/send/home"
                className="text-[13px] font-semibold text-send-body hover:text-send-primary"
              >
                Customer view
              </Link>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-5">
            <AdminNav permissions={context.admin.permissions} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
