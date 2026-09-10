"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

/**
 * Product navigation.
 *
 * Mobile gets a fixed bottom bar with five large tap targets — a phone user
 * sending money should never have to hunt through a menu. Desktop gets a
 * sidebar with the same destinations plus the secondary ones.
 */

const PRIMARY = [
  { href: "/send/home", label: "Home", icon: "🏠" },
  { href: "/send/new", label: "Send", icon: "💸" },
  { href: "/send/recipients", label: "Recipients", icon: "👥" },
  { href: "/send/transactions", label: "Activity", icon: "📋" },
  { href: "/send/profile", label: "Profile", icon: "⚙️" },
];

const SECONDARY = [
  { href: "/send/rates", label: "Rates", icon: "📈" },
  { href: "/send/help", label: "Help & support", icon: "💬" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/send/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-send-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-bold",
                  active ? "text-send-primary" : "text-send-muted",
                )}
              >
                <span aria-hidden className="text-[19px] leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-1">
      {[...PRIMARY, ...SECONDARY].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition",
              active
                ? "bg-send-primary-soft text-send-primary"
                : "text-send-body hover:bg-send-canvas hover:text-send-ink",
            )}
          >
            <span aria-hidden className="text-[16px]">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
