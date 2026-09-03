"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useLife } from "@/lib/life/store";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Kicker, Panel } from "@/components/life/ui";

/** "just now", "4 minutes ago", "2 hours ago" — no false precision. */
function ago(at: number | null): string {
  if (!at) return "not yet";
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * The state of sync, said plainly.
 *
 * The rule this panel follows: never imply your data is somewhere it isn't.
 * Signed out it says "this device only" rather than showing a hopeful spinner,
 * and offline it says the work is safe here and will go up later.
 */
export function SyncPanel() {
  const { sync } = useLife();
  const [, tick] = useState(0);

  // Re-render so "4 minutes ago" stays true while the page sits open.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const copy = {
    off: {
      chip: <Chip>This device only</Chip>,
      title: "Not syncing",
      body: "Everything you log lives in this browser and goes no further. Sign in to keep the same day on your laptop and your phone.",
    },
    idle: {
      chip: <Chip tone="accent">Synced</Chip>,
      title: `Synced ${ago(sync.lastSyncedAt)}`,
      body: "Changes go up a moment after you make them, and come down when you open the app or switch back to this tab.",
    },
    syncing: {
      chip: <Chip>Syncing…</Chip>,
      title: "Syncing now",
      body: "Sending this device's changes and picking up anything logged elsewhere.",
    },
    offline: {
      chip: <Chip tone="warn">Offline</Chip>,
      title: "Offline — saved on this device",
      body: "Nothing is lost. The moment you are back online this device pushes what you logged and pulls anything waiting.",
    },
    error: {
      chip: <Chip tone="warn">Sync problem</Chip>,
      title: "Could not reach the server",
      body: sync.error ?? "Your data is safe on this device. It will keep retrying.",
    },
  }[sync.status];

  return (
    <Panel className="rise p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Kicker>Sync</Kicker>
        {copy.chip}
        {sync.account ? <span className="text-[12px] text-[var(--ink-4)]">{sync.account}</span> : null}
      </div>

      <div className="mt-4 flex items-start gap-3">
        <Icon
          name={sync.status === "off" ? "Shield" : sync.status === "idle" ? "Check" : "RotateCcw"}
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-3)]"
        />
        <div>
          <div className="text-[15px] font-semibold tracking-tight">{copy.title}</div>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-3)]">{copy.body}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {sync.status === "off" ? (
          <Link href="/login?callbackUrl=/life/settings" className="btn btn-accent">
            <Icon name="ArrowRight" className="h-4 w-4" />
            Sign in to sync
          </Link>
        ) : (
          <>
            <Btn icon="RotateCcw" onClick={sync.syncNow} disabled={sync.status === "syncing"}>
              Sync now
            </Btn>
            <Btn variant="ghost" onClick={() => void signOut({ redirect: false })}>
              Sign out of sync
            </Btn>
          </>
        )}
      </div>

      {sync.status !== "off" ? (
        <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-[var(--ink-4)]">
          Each day is merged on its own, so a morning logged on one device and an evening logged on another both
          survive. Settings, your north star, the challenge, people and places are single values that cannot be
          combined — for those, the device you changed most recently wins. Deleting a person while a second device is
          offline can bring them back when that device next syncs.
        </p>
      ) : null}
    </Panel>
  );
}
