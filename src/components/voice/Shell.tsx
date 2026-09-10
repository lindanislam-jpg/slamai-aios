"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpen, Bot, Calendar, CreditCard, LayoutDashboard, LogOut,
  Menu, MessageSquareText, Phone, Settings, Shield, Users, X, ChevronsUpDown, Check,
} from "lucide-react";
import { Badge } from "./ui";

export type Workspace = { id: string; name: string; slug: string; role: string; status: string };

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/calls", label: "Calls", icon: Phone },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/appointments", label: "Appointments", icon: Calendar },
  { href: "/app/agents", label: "AI Receptionist", icon: Bot },
  { href: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/app/test", label: "Test your AI", icon: MessageSquareText },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export default function Shell({
  children,
  workspaces,
  currentWorkspaceId,
  businessName,
  planName,
  userName,
  userEmail,
  isPlatformAdmin,
  suspended,
}: {
  children: React.ReactNode;
  workspaces: Workspace[];
  currentWorkspaceId: string;
  businessName: string;
  planName: string;
  userName: string | null;
  userEmail: string;
  isPlatformAdmin: boolean;
  suspended: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  async function switchWorkspace(id: string) {
    await fetch("/api/v1/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: id }),
    });
    // A full reload is deliberate: every server component on the page is
    // scoped to the old tenant and must be re-rendered.
    window.location.href = "/app";
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
          <Phone className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-white">SlamAI</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-indigo-400">Voice</div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="relative px-3 pb-3">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-slate-200">{businessName}</span>
            <span className="block text-[11px] text-slate-500">{planName}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </button>

        {switcherOpen && (
          <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#16162e] shadow-2xl">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block truncate">{w.name}</span>
                  <span className="text-[11px] capitalize text-slate-500">{w.role}</span>
                </span>
                {w.id === currentWorkspaceId && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
              </button>
            ))}
            <Link
              href="/app/settings?tab=workspaces"
              onClick={() => setSwitcherOpen(false)}
              className="block border-t border-white/[0.06] px-3 py-2.5 text-[13px] text-indigo-300 hover:bg-white/[0.06]"
            >
              Add a workspace
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-indigo-500/20 to-transparent text-white shadow-[inset_2px_0_0_0_rgb(99,102,241)]"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              )}
            >
              <Icon className={cn("h-[17px] w-[17px] shrink-0", active && "text-indigo-400")} />
              {item.label}
            </Link>
          );
        })}

        {isPlatformAdmin && (
          <Link
            href="/app/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "mt-3 flex items-center gap-3 rounded-xl border border-amber-500/20 px-3 py-2.5 text-[13.5px] font-medium transition-all",
              isActive("/app/admin")
                ? "bg-amber-500/15 text-amber-200"
                : "text-amber-300/80 hover:bg-amber-500/10"
            )}
          >
            <Shield className="h-[17px] w-[17px] shrink-0" />
            SlamAI Admin
          </Link>
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 px-2">
          <div className="truncate text-[13px] font-medium text-slate-300">{userName ?? "Your account"}</div>
          <div className="truncate text-[11px] text-slate-500">{userEmail}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/voice" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
        >
          <LogOut className="h-[17px] w-[17px]" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b1a]">
      {/* Ambient brand glow — purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% -10%, rgba(99,102,241,0.14), transparent), radial-gradient(ellipse 50% 40% at 90% 100%, rgba(6,182,212,0.07), transparent)",
        }}
      />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-white/[0.06] bg-[#0e0e1f]/90 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-white/[0.06] bg-[#0e0e1f] lg:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </>
      )}

      <div className="relative z-10 lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0b0b1a]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-medium text-slate-200">{businessName}</span>
        </header>

        {suspended && (
          <div className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-3 text-[13px] text-rose-200">
            This workspace is suspended, so your AI is not answering calls. Contact support to reactivate it.
          </div>
        )}

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { Badge };
