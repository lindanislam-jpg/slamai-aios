/**
 * The public marketing surface: the landing page, pricing, the demo form and
 * signup. A route group, so these share the product's dark ground without
 * adding a path segment.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#08081a] text-slate-100">{children}</div>;
}
