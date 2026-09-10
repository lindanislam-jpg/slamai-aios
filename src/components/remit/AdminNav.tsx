"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

/** Admin tabs, filtered to the permissions this admin actually holds. */
const TABS = [
  { href: "/send/admin", label: "Overview", permission: "transfers:view" },
  { href: "/send/admin/transfers", label: "Transfers", permission: "transfers:view" },
  { href: "/send/admin/reviews", label: "Reviews", permission: "compliance:review" },
  { href: "/send/admin/customers", label: "Customers", permission: "customers:view" },
  { href: "/send/admin/fees", label: "Fees", permission: "fees:manage" },
  { href: "/send/admin/corridors", label: "Corridors", permission: "corridors:manage" },
  { href: "/send/admin/audit", label: "Audit log", permission: "audit:view" },
];

export function AdminNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = TABS.filter((tab) => permissions.includes(tab.permission));

  return (
    <nav aria-label="Admin sections" className="-mb-px flex gap-1 overflow-x-auto">
      {visible.map((tab) => {
        const active = tab.href === "/send/admin" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-bold transition",
              active
                ? "border-send-primary text-send-primary"
                : "border-transparent text-send-muted hover:text-send-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
