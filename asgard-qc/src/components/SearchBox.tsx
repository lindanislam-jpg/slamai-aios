"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Hit {
  type: string;
  code: string;
  title: string;
  href: string;
  context?: string | null;
}

export function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (res.ok) setHits((await res.json()).hits);
      } catch {
        /* aborted */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={box} className="relative w-full max-w-md">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          setOpen(false);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-300" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search project, frame, weld, heat no., NCR…  (Ctrl K)"
          aria-label="Search all records"
          className="input pl-9"
        />
      </form>
      {open && hits.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-ink-500 bg-ink-850 py-1 shadow-xl">
          {hits.slice(0, 12).map((h) => (
            <li key={`${h.type}-${h.href}-${h.code}`}>
              <Link href={h.href} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-ink-700" onClick={() => setOpen(false)}>
                <span className="mt-0.5 w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold-400">{h.type}</span>
                <span className="min-w-0">
                  <span className="font-medium text-ink-100">{h.code}</span> <span className="text-ink-300">{h.title}</span>
                  {h.context && <span className="block text-xs text-ink-400">{h.context}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
