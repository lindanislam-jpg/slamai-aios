/**
 * What remains under /voice: the workspace-creation page, plus permanent
 * redirects for the marketing URLs that used to live here.
 */
export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#08081a] text-slate-100">{children}</div>;
}
