"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";

const LINKS = [
  { href: "/voice#how", label: "How it works" },
  { href: "/voice#features", label: "Features" },
  { href: "/voice#industries", label: "Industries" },
  { href: "/voice/pricing", label: "Pricing" },
  { href: "/voice#faq", label: "FAQ" },
];

export default function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08081a]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/voice" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
            <Phone className="h-4 w-4 text-white" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-white">SlamAI</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-400">Voice</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-[14px] text-slate-400 transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/voice/login" className="text-[14px] text-slate-300 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            href="/voice/signup"
            className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-[14px] font-medium text-white shadow-lg shadow-indigo-900/40 transition-all hover:from-indigo-400 hover:to-violet-500"
          >
            Start Free
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4 lg:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-[15px] text-slate-300"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 flex gap-2">
            <Link href="/voice/login" className="flex-1 rounded-xl border border-white/10 py-2.5 text-center text-[14px] text-slate-200">
              Sign in
            </Link>
            <Link href="/voice/signup" className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-center text-[14px] font-medium text-white">
              Start Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
