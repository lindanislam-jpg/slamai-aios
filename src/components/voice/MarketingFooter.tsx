import Link from "next/link";
import { Phone } from "lucide-react";

export default function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#06060f]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                <Phone className="h-4 w-4 text-white" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight text-white">SlamAI</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-400">Voice</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-500">
              Your AI receptionist. It answers every call, captures the lead and books the job — around the clock.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: "/voice#how", label: "How it works" },
              { href: "/voice#features", label: "Features" },
              { href: "/voice#industries", label: "Industries" },
              { href: "/voice/pricing", label: "Pricing" },
            ]}
          />
          <FooterColumn
            title="Get started"
            links={[
              { href: "/voice/signup", label: "Start free" },
              { href: "/voice/demo", label: "Book a demo" },
              { href: "/voice/login", label: "Sign in" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { href: "/voice#faq", label: "FAQ" },
              { href: "/", label: "SlamAI platform" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[12.5px] text-slate-500">
          <span>© {year} SlamAI. All rights reserved.</span>
          <span>Prices exclude VAT. Voice minutes are subject to plan limits.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-[13.5px] text-slate-500 transition-colors hover:text-slate-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
