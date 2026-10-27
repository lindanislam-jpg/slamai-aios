export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
      <path d="M4 38 L24 3 L44 38" fill="none" stroke="#c39a45" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M13 38 L24 18 L35 38" fill="none" stroke="#c39a45" strokeWidth="2.5" strokeLinejoin="round" opacity="0.8" />
      <path d="M20 38 L24 31 L28 38" fill="none" stroke="#e6c77f" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-[0.28em] text-ink-100">ASGARD</div>
        <div className="text-[9px] font-medium tracking-[0.2em] text-gold-400">MODULAR MANUFACTURING</div>
      </div>
    </div>
  );
}
