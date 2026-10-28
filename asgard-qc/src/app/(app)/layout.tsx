import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { Sidebar } from "@/components/Sidebar";
import { SearchBox } from "@/components/SearchBox";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoRecordCount } from "@/lib/kpi";
import { ROLE_LABELS } from "@/lib/permissions";
import { maybeScan } from "@/lib/services/notifications";
import { pageLoadTick } from "@/lib/monitor/run";
import { qmsStatus } from "@/lib/integrations/qms";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  // Refresh reminders at most every 10 minutes; never blocks the page on error.
  await maybeScan(10).catch((e) => console.error("notification scan failed", e));
  // The host cron runs the 09:00/12:00/18:00 reviews; this only catches a slot it missed, after the response.
  after(() => pageLoadTick().catch((e) => console.error("scheduled review safety net failed", e)));
  const [unread, demo] = await Promise.all([db.notification.count({ where: { userId: actor.id, readAt: null, resolvedAt: null } }), demoRecordCount()]);
  const qms = qmsStatus();
  const now = new Date();

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={[...actor.permissions]} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-600 bg-ink-900/90 px-4 py-2.5 pl-14 backdrop-blur lg:pl-6">
          <div className="hidden min-w-0 shrink-0 xl:block">
            <div className="text-sm font-semibold tracking-wide text-ink-100">QUALITY DEPARTMENT</div>
            <div className="text-[10px] tracking-[0.18em] text-ink-300">INSPECT · ASSURE · BUILD BETTER</div>
          </div>
          <div className="flex flex-1 justify-center">
            <SearchBox />
          </div>
          <div className="flex items-center gap-2">
            {demo > 0 && (
              <Link href="/settings?tab=data" className="hidden rounded-md border border-gold-600/60 bg-gold-600/10 px-2 py-1 text-[11px] font-semibold leading-tight text-gold-300 md:block" title="Synthetic demonstration records are present">
                DEMO DATA
                <span className="block text-[9px] font-normal text-gold-400">{qms.connected ? qms.label : "Not connected to live QMS"}</span>
              </Link>
            )}
            <div className="hidden text-right text-xs leading-tight text-ink-300 md:block">
              <div>{now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
            <Link href="/notifications" className="btn-ghost relative" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-bad-500 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link href="/account" className="hidden items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink-700 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-600 text-xs font-bold text-gold-300">
                {actor.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="leading-tight">
                <span className="block text-sm text-ink-100">{actor.name}</span>
                <span className="block text-[11px] text-ink-300">{ROLE_LABELS[actor.role]}</span>
              </span>
            </Link>
            <form action={logout}>
              <button className="btn-ghost" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-ink-600 px-6 py-3 text-[11px] text-ink-400">
          <span>ASGARD MODULAR MANUFACTURING | QUALITY DEPARTMENT</span>
          <span>{demo > 0 ? "Contains demo data · " : ""}Internal use only</span>
          <span>Version 1.0.0</span>
        </footer>
      </div>
    </div>
  );
}
