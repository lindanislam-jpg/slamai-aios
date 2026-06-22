"use client";

import { useSession } from "next-auth/react";
import { Bell, Search, Sparkles } from "lucide-react";

export default function Header({ title }: { title: string }) {
  const { data: session } = useSession();
  const initials = session?.user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <header className="h-16 bg-slam-card/50 border-b border-slam-border flex items-center justify-between px-6 sticky top-0 z-30 backdrop-blur-sm">
      <h1 className="font-bold text-lg text-slate-100">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search anything…"
            className="bg-slam-dark border border-slam-border rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500 w-56 transition-all focus:w-72"
          />
        </div>

        <div className="relative">
          <button className="w-9 h-9 rounded-lg bg-slam-dark border border-slam-border flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 rounded-full text-[10px] text-white flex items-center justify-center font-bold">3</span>
        </div>

        <div className="flex items-center gap-2.5 pl-3 border-l border-slam-border">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-slate-200 leading-none">{session?.user?.name || "User"}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Sparkles className="w-2.5 h-2.5 text-brand-400" />
              {(session?.user as { plan?: string })?.plan || "Free"} Plan
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
