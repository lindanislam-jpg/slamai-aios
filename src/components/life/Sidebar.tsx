"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/life/nav";
import { HABITS } from "@/lib/life/habits";
import { dailyScore, getDay, levelFor, momentum, totalXp } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { Icon } from "./icons";
import { Bar } from "./ui";

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/life" ? pathname === "/life" : pathname.startsWith(href));
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { state, today } = useLife();
  const isActive = useActive();
  const xp = totalXp(state);
  const { level, into, span } = levelFor(xp);
  const day = getDay(state, today);
  const done = HABITS.filter((h) => day.habits[h.id]).length;

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/life"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 py-5 transition-opacity hover:opacity-80"
      >
        <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-[var(--hair)] bg-[var(--panel-strong)]">
          <span className="absolute inset-0 rounded-xl opacity-40 blur-md" style={{ background: "var(--accent-glow)" }} />
          <Icon name="Compass" className="relative h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight">Elite Life OS</span>
          <span className="kicker">Personal Command</span>
        </span>
      </Link>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-3.5">
            <div className="kicker px-3 pb-2">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    data-active={active}
                    className={cn(
                      "nav-item flex items-center gap-3 rounded-xl px-3 py-[7px] text-[13.5px]",
                      active
                        ? "bg-[var(--panel-strong)] font-semibold text-[var(--ink)]"
                        : "text-[var(--ink-3)] hover:bg-[var(--panel)] hover:text-[var(--ink)]",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className="h-[17px] w-[17px] shrink-0"
                      strokeWidth={active ? 2 : 1.6}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.href === "/life/habits" ? (
                      <span className="ml-auto text-[11px] tabular-nums text-[var(--ink-4)]">{done}/8</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-3 shrink-0 rounded-2xl border border-[var(--hair)] bg-[var(--panel)] px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="kicker">Level {level}</span>
          <span className="text-[11px] text-[var(--ink-4)]">
            Today {dailyScore(day)}% · {momentum(state, today).score}
          </span>
        </div>
        <Bar value={(into / span) * 100} className="mt-2.5" />
        <div className="mt-2 text-[10.5px] text-[var(--ink-4)]">{xp.toLocaleString()} XP</div>
      </div>
    </div>
  );
}

/** Mobile bottom navigation — the five destinations that matter on a phone. */
export function MobileNav() {
  const isActive = useActive();
  const items = [
    { href: "/life", label: "Home", icon: "Home" },
    { href: "/life/morning", label: "Morning", icon: "Sunrise" },
    { href: "/life/habits", label: "Habits", icon: "Layers" },
    { href: "/life/momentum", label: "Momentum", icon: "Activity" },
    { href: "/life/night", label: "Night", icon: "MoonStar" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hair)] lg:hidden"
      style={{
        background: "color-mix(in srgb, var(--bg) 84%, transparent)",
        backdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2.5 transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
            >
              <Icon name={item.icon} className="h-[19px] w-[19px]" strokeWidth={active ? 2.1 : 1.6} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
