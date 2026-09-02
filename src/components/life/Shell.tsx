"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_FLAT } from "@/lib/life/nav";
import { greeting, longDate } from "@/lib/life/date";
import { registerServiceWorker } from "@/lib/life/alarm";
import { useLife, useMounted, useNow, type Notice } from "@/lib/life/store";
import { AlarmProvider, useAlarm } from "./AlarmLayer";
import { CoachDock } from "./CoachDock";
import { CommandPalette, type Command } from "./CommandPalette";
import { Icon } from "./icons";
import { MobileNav, Sidebar } from "./Sidebar";
import { IconBtn } from "./ui";

/* ------------------------------------------------------------------ *
 * Toasts — the surface for every micro-interaction reward
 * ------------------------------------------------------------------ */

function Toasts() {
  const { notices, dismiss } = useLife();
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    const fresh = notices.filter((n) => Date.now() - n.at < 800).map((n) => n.id);
    if (!fresh.length) return;
    setVisible((prev) => [...new Set([...fresh, ...prev])].slice(0, 3));
    const timers = fresh.map((id) =>
      window.setTimeout(() => setVisible((prev) => prev.filter((v) => v !== id)), 4200),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [notices]);

  const shown = visible
    .map((id) => notices.find((n) => n.id === id))
    .filter((n): n is Notice => Boolean(n));

  if (!shown.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
      {shown.map((n) => (
        <div
          key={n.id}
          className="panel panel-lit pop pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3"
        >
          <span
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
            style={{
              background:
                n.tone === "success" ? "var(--accent-soft)" : n.tone === "warn" ? "color-mix(in srgb, var(--warn) 16%, transparent)" : "var(--panel-strong)",
              color: n.tone === "success" ? "var(--accent)" : n.tone === "warn" ? "var(--warn)" : "var(--ink-2)",
            }}
          >
            <Icon name={n.tone === "success" ? "Check" : n.tone === "warn" ? "Info" : "Bell"} className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold tracking-tight">{n.title}</div>
            {n.body ? <div className="mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">{n.body}</div> : null}
          </div>
          {n.xp ? (
            <span
              className="num shrink-0 text-[13px]"
              style={{ color: "var(--accent)", animation: "life-xp 1.6s var(--ease) forwards" }}
            >
              +{n.xp}
            </span>
          ) : null}
          <button onClick={() => dismiss(n.id)} className="shrink-0 text-[var(--ink-4)] hover:text-[var(--ink)]">
            <Icon name="X" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Notification centre
 * ------------------------------------------------------------------ */

function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notices, markAllRead } = useLife();

  useEffect(() => {
    if (open) markAllRead();
  }, [open, markAllRead]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div className="panel panel-lit rise absolute right-0 top-12 z-[71] w-[320px] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--hair)] px-4 py-3">
          <span className="kicker">Notifications</span>
          <span className="text-[11px] text-[var(--ink-4)]">{notices.length}</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {notices.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">
              Nothing yet. Complete something and it will land here.
            </p>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="border-b border-[var(--hair)] px-4 py-3 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-[var(--ink-4)]">
                    {new Date(n.at).toTimeString().slice(0, 5)}
                  </span>
                </div>
                {n.body ? <p className="mt-1 text-[12px] leading-snug text-[var(--ink-3)]">{n.body}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Top bar
 * ------------------------------------------------------------------ */

function TopBar({
  onCommand,
  onMenu,
}: {
  onCommand: () => void;
  onMenu: () => void;
}) {
  const { state, notices, updateSettings } = useLife();
  const pathname = usePathname();
  const mounted = useMounted();
  const now = useNow(30_000);
  const [bell, setBell] = useState(false);
  const current = NAV_FLAT.find((n) => (n.href === "/life" ? pathname === "/life" : pathname.startsWith(n.href)));
  const unread = notices.filter((n) => !n.read).length;

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--hair)]"
      style={{
        background: "color-mix(in srgb, var(--bg) 78%, transparent)",
        backdropFilter: "blur(18px) saturate(140%)",
      }}
    >
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button onClick={onMenu} className="lg:hidden" aria-label="Open menu">
          <Icon name="Layers" className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 lg:block">
          <div className="text-[13.5px] font-semibold tracking-tight">{current?.label ?? "Command Center"}</div>
          <div className="text-[11px] text-[var(--ink-4)]">
            {mounted ? `${greeting(now)}, ${state.profile.name} · ${longDate(now)}` : " "}
          </div>
        </div>

        <button
          onClick={onCommand}
          className="ml-auto flex h-9 flex-1 items-center gap-2.5 rounded-full border border-[var(--hair)] bg-[var(--panel)] px-3.5 text-[13px] text-[var(--ink-4)] transition hover:border-[var(--hair-strong)] sm:max-w-xs lg:ml-6 lg:mr-auto"
        >
          <Icon name="Search" className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="hidden rounded border border-[var(--hair)] px-1.5 text-[10px] sm:block">⌘K</kbd>
        </button>

        <div className="relative flex items-center gap-2">
          <IconBtn
            icon={state.settings.theme === "dark" ? "Sunrise" : "MoonStar"}
            label="Toggle theme"
            className="hidden sm:grid"
            onClick={() => updateSettings({ theme: state.settings.theme === "dark" ? "light" : "dark" })}
          />
          <div className="relative">
            <IconBtn icon="Bell" label="Notifications" onClick={() => setBell((v) => !v)} />
            {unread ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold"
                style={{ background: "var(--accent)", color: "hsl(var(--a-h) 60% 8%)" }}
              >
                {unread}
              </span>
            ) : null}
            <NotificationCenter open={bell} onClose={() => setBell(false)} />
          </div>
          <Link
            href="/life/settings"
            aria-label="Profile and settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--hair)] text-[12px] font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {state.profile.name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

function Chrome({ children }: { children: React.ReactNode }) {
  const { state, notify } = useLife();
  const { ring } = useAlarm();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [coach, setCoach] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  /* Global keyboard shortcuts. Single letters are ignored while typing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const go: Record<string, string> = {
        d: "/life",
        m: "/life/morning",
        j: "/life/journal",
        l: "/life/learning",
        h: "/life/habits",
        n: "/life/night",
        w: "/life/weekly",
        p: "/life/progress",
      };
      if (e.key === "?") {
        e.preventDefault();
        setPalette(true);
      } else if (e.key.toLowerCase() === "c") {
        setCoach((v) => !v);
      } else if (go[e.key.toLowerCase()]) {
        router.push(go[e.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const extraCommands = useMemo<Command[]>(
    () => [
      {
        id: "act:coach",
        label: "Ask the AI Life Coach",
        icon: "Sparkles",
        group: "Actions",
        hint: "C",
        run: () => {
          setCoach(true);
          setPalette(false);
        },
      },
      {
        id: "act:test-wake",
        label: "Test wake-up alarm",
        icon: "AlarmClock",
        group: "Actions",
        run: () => {
          setPalette(false);
          ring("wake", { test: true });
        },
      },
      {
        id: "act:test-bed",
        label: "Test bedtime alarm",
        icon: "MoonStar",
        group: "Actions",
        run: () => {
          setPalette(false);
          ring("bed", { test: true });
        },
      },
      {
        id: "act:export",
        label: "Export data as JSON",
        icon: "Download",
        group: "Actions",
        run: () => {
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `elite-life-os-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          notify({ title: "Backup downloaded", tone: "success" });
          setPalette(false);
        },
      },
    ],
    [ring, state, notify],
  );

  return (
    <div className="relative flex min-h-screen">
      <div className="life-canvas" />

      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-[var(--hair)] lg:block">
        <Sidebar />
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="scrim fade absolute inset-0" onClick={() => setDrawer(false)} />
          <div className="rise absolute inset-y-0 left-0 w-[268px] border-r border-[var(--hair)] bg-[var(--bg)]">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar onCommand={() => setPalette(true)} onMenu={() => setDrawer(true)} />
        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>

      <MobileNav />
      <Toasts />
      <CommandPalette open={palette} onClose={() => setPalette(false)} extraCommands={extraCommands} />
      <CoachDock open={coach} onOpenChange={setCoach} />
    </div>
  );
}

/**
 * Boot screen. The whole app is time- and localStorage-dependent, so it renders
 * nothing until the store has hydrated on the client: the server and the first
 * client paint agree on this screen exactly, and no clock or streak can produce
 * a hydration mismatch.
 */
function Boot() {
  return (
    <div className="relative grid min-h-screen place-items-center">
      <div className="life-canvas" />
      <div className="relative flex flex-col items-center gap-5">
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[var(--hair)] bg-[var(--panel-strong)]">
          <span className="absolute inset-0 rounded-2xl opacity-50 blur-xl" style={{ background: "var(--accent-glow)" }} />
          <Icon name="Compass" className="relative h-6 w-6" strokeWidth={1.6} />
        </span>
        <div className="text-center">
          <div className="display text-[15px] tracking-tight">Elite Life OS</div>
          <div className="kicker mt-1.5">Loading your system</div>
        </div>
        <div className="sheen h-0.5 w-32 overflow-hidden rounded-full bg-[var(--panel-strong)]" />
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, ready } = useLife();

  /* Theme, accent and motion are attributes on one root node — every token in
     life.css keys off them, so a change repaints the whole app instantly. */
  return (
    <div
      data-life=""
      data-theme={state.settings.theme}
      data-accent={state.settings.accent}
      data-motion={state.settings.reducedMotion ? "reduced" : "full"}
      className="min-h-screen"
    >
      {ready ? (
        <AlarmProvider>
          <Chrome>{children}</Chrome>
        </AlarmProvider>
      ) : (
        <Boot />
      )}
    </div>
  );
}
