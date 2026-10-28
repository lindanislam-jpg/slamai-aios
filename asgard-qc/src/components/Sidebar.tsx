"use client";

import clsx from "clsx";
import {
  Activity, BadgeCheck, BarChart3, Boxes, Camera, ClipboardCheck, FileText, Flame, FolderKanban, Gauge, Layers, Paintbrush,
  Hammer, Radar, Ruler, Settings, ShieldCheck, Siren, TriangleAlert, Users, Wrench, Menu, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

export const NAV = [
  { href: "/", label: "Executive Quality Overview", icon: Gauge },
  { href: "/projects", label: "Project Register", icon: FolderKanban },
  { href: "/photos", label: "Project Photo Evidence", icon: Camera },
  { href: "/fabrication", label: "Fabrication QC", icon: Ruler },
  { href: "/welding", label: "Welding QC", icon: Flame },
  { href: "/frames", label: "Frame & Module Tracking", icon: Layers },
  { href: "/materials", label: "Material Traceability", icon: Boxes },
  { href: "/inspections", label: "Inspection Register", icon: ClipboardCheck },
  { href: "/ndt", label: "NDT & Test Records", icon: Radar },
  { href: "/coating", label: "Painting & Coating QC", icon: Paintbrush },
  { href: "/ncr", label: "NCR & CAPA Management", icon: TriangleAlert },
  { href: "/rework", label: "Rework & Repair Tracking", icon: Wrench },
  { href: "/cmr", label: "Corrective Maintenance (CMR)", icon: Hammer },
  { href: "/alerts", label: "Smart Quality Alerts", icon: Siren },
  { href: "/release", label: "Final Inspection & Release", icon: BadgeCheck },
  { href: "/audits", label: "Audit & Compliance Centre", icon: ShieldCheck },
  { href: "/documents", label: "Documents & Calibration", icon: FileText },
  { href: "/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/users", label: "User Management", icon: Users, perm: "users.manage" },
  { href: "/settings", label: "Settings & Integrations", icon: Settings, perm: "settings.manage" },
  { href: "/activity", label: "Activity Log", icon: Activity },
] as const;

export function Sidebar({ permissions }: { permissions: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !("perm" in n) || permissions.includes(n.perm));

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition",
              active ? "bg-gradient-to-r from-ok-600/25 to-transparent text-ink-100 ring-1 ring-ok-600/30" : "text-ink-200 hover:bg-ink-700 hover:text-ink-100",
            )}
          >
            <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-ok-400" : "text-ink-300 group-hover:text-gold-400")} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button className="btn-ghost fixed left-3 top-3 z-40 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-600 bg-ink-900 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-600 px-4 py-4">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        {nav}
        <div className="border-t border-ink-600 px-5 py-4">
          <div className="text-[11px] font-semibold tracking-[0.3em] text-ink-200">QUALITY BUILDS TRUST</div>
          <div className="mt-1 text-[9px] tracking-[0.2em] text-ink-400">ASGARD MODULAR MANUFACTURING</div>
        </div>
      </aside>
    </>
  );
}
