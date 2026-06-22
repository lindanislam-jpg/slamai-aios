"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Bot, Users, Zap, Globe, Megaphone,
  Mic, FileText, BarChart3, Kanban, Store,
  Sparkles, LogOut, Settings, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/agents",       label: "AI Agent Hub",    icon: Bot },
  { href: "/crm",          label: "CRM",             icon: Users },
  { href: "/automation",   label: "Automation",      icon: Zap },
  { href: "/marketing",    label: "Marketing AI",    icon: Megaphone },
  { href: "/voice-ai",     label: "Voice AI",        icon: Mic },
  { href: "/documents",    label: "Documents",       icon: FileText },
  { href: "/analytics",    label: "Analytics",       icon: BarChart3 },
  { href: "/projects",     label: "Projects",        icon: Kanban },
  { href: "/marketplace",  label: "Marketplace",     icon: Store },
  { href: "/website",      label: "Website Builder", icon: Globe },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-64 bg-slam-card border-r border-slam-border flex flex-col h-screen sticky top-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slam-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm leading-none">SlamAI</div>
          <div className="text-xs text-brand-400 font-medium">AIOS™</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active
                  ? "active bg-brand-600/20 text-brand-300 border-l-2 border-brand-500"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300")} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-brand-500" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slam-border p-3 space-y-0.5">
        <Link href="/settings" className="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200">
          <Settings className="w-4 h-4 text-slate-500" /> Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
