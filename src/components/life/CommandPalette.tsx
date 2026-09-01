"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_FLAT } from "@/lib/life/nav";
import { HABITS } from "@/lib/life/habits";
import { getDay } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { Icon } from "./icons";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: string;
  run: () => void;
  keywords?: string[];
}

export function CommandPalette({
  open,
  onClose,
  extraCommands = [],
}: {
  open: boolean;
  onClose: () => void;
  extraCommands?: Command[];
}) {
  const router = useRouter();
  const { state, today, toggleHabit, updateSettings, notify } = useLife();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const day = getDay(state, today);
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };

    const nav: Command[] = NAV_FLAT.map((item) => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: "Go to",
      icon: item.icon,
      group: "Navigate",
      keywords: item.keywords,
      run: go(item.href),
    }));

    const habits: Command[] = HABITS.map((h) => ({
      id: `habit:${h.id}`,
      label: `${day.habits[h.id] ? "Undo" : "Complete"} — ${h.name}`,
      hint: day.habits[h.id] ? "Completed today" : "Mark done",
      icon: h.icon,
      group: "Habits",
      keywords: [h.principle, h.verb],
      run: () => {
        toggleHabit(h.id);
        if (!day.habits[h.id]) {
          notify({ title: `${h.name} complete`, tone: "success", xp: 20 });
        }
        onClose();
      },
    }));

    const system: Command[] = [
      {
        id: "sys:theme",
        label: state.settings.theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: state.settings.theme === "dark" ? "Sunrise" : "MoonStar",
        group: "System",
        run: () => {
          updateSettings({ theme: state.settings.theme === "dark" ? "light" : "dark" });
          onClose();
        },
      },
      {
        id: "sys:motion",
        label: state.settings.reducedMotion ? "Enable animations" : "Reduce motion",
        icon: "Move",
        group: "System",
        run: () => {
          updateSettings({ reducedMotion: !state.settings.reducedMotion });
          onClose();
        },
      },
    ];

    return [...extraCommands, ...habits, ...nav, ...system];
  }, [state, today, router, onClose, toggleHabit, updateSettings, notify, extraCommands]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      [c.label, c.group, c.hint ?? "", ...(c.keywords ?? [])].join(" ").toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      // Focus after paint so the caret lands reliably on mobile Safari too.
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        results[index]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, index, onClose]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[8vh] sm:pt-[14vh]">
      <div className="scrim fade absolute inset-0" onClick={onClose} />
      <div className="panel panel-lit rise relative z-10 w-full max-w-xl overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-[var(--hair)] px-4">
          <Icon name="Search" className="h-[18px] w-[18px] text-[var(--ink-3)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, jump, or complete a habit…"
            aria-label="Command palette"
            className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-[var(--ink-4)]"
          />
          <kbd className="hidden rounded border border-[var(--hair)] px-1.5 py-0.5 text-[10px] text-[var(--ink-4)] sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--ink-3)]">
              Nothing matches “{query}”.
            </div>
          ) : (
            results.map((c, i) => {
              const showGroup = c.group !== lastGroup;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {showGroup ? <div className="kicker px-3 pb-1.5 pt-3">{c.group}</div> : null}
                  <button
                    data-i={i}
                    onMouseEnter={() => setIndex(i)}
                    onClick={c.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition",
                      i === index ? "bg-[var(--panel-strong)]" : "hover:bg-[var(--panel)]",
                    )}
                  >
                    <Icon name={c.icon} className="h-[17px] w-[17px] shrink-0 text-[var(--ink-2)]" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint ? <span className="text-[11px] text-[var(--ink-4)]">{c.hint}</span> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--hair)] px-4 py-2.5 text-[11px] text-[var(--ink-4)]">
          <span>↑↓ navigate · ⏎ run</span>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
