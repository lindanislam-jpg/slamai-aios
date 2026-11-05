"use client";

import { useState } from "react";
import { useTv } from "@/lib/tv/store";

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 560 }}>{label}</div>
        <p className="tv-hint" style={{ marginTop: 3, maxWidth: "58ch" }}>
          {hint}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{
          flex: "none",
          width: 46,
          height: 27,
          borderRadius: 999,
          border: "1px solid var(--tv-hair)",
          background: on ? "var(--tv-accent)" : "var(--tv-panel-strong)",
          position: "relative",
          transition: "background 0.18s var(--tv-ease)",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: on ? 21 : 2,
            height: 21,
            width: 21,
            borderRadius: 999,
            background: on ? "hsl(268 60% 12%)" : "var(--tv-ink-3)",
            transition: "left 0.18s var(--tv-ease)",
          }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { state, updateSettings, clearDead, reset } = useTv();
  const [confirmReset, setConfirmReset] = useState(false);
  const deadCount = Object.keys(state.dead).length;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 680 }}>
      <div>
        <div className="tv-display" style={{ fontSize: 19 }}>
          Settings
        </div>
        <p className="tv-hint" style={{ marginTop: 4 }}>
          Everything is stored on this device. No account, no watch history leaves your browser.
        </p>
      </div>

      <section className="tv-panel" style={{ padding: 16, display: "grid", gap: 20 }}>
        <Toggle
          label="Route streams through this app"
          hint="Most broadcasters don't allow a browser to play their stream directly, so the app relays it. Turn this off only if a channel plays better without it — some streams are faster direct."
          on={state.settings.useProxy}
          onChange={(v) => updateSettings({ useProxy: v })}
        />
        <Toggle
          label="Hide channels that failed"
          hint="Live playlists always contain some dead entries. This hides any channel that failed to load on this device."
          on={state.settings.hideDead}
          onChange={(v) => updateSettings({ hideDead: v })}
        />
      </section>

      <section className="tv-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
        <span className="tv-kicker">Maintenance</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="tv-btn tv-btn-sm" onClick={clearDead} disabled={!deadCount}>
            Clear failed list{deadCount ? ` (${deadCount})` : ""}
          </button>
          {confirmReset ? (
            <>
              <button
                className="tv-btn tv-btn-sm tv-btn-danger"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                }}
              >
                Yes, erase everything
              </button>
              <button className="tv-btn tv-btn-sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="tv-btn tv-btn-sm tv-btn-danger" onClick={() => setConfirmReset(true)}>
              Reset app
            </button>
          )}
        </div>
        <p className="tv-hint">
          Reset removes your sources, favourites and history from this device and starts fresh.
        </p>
      </section>

      <section className="tv-panel" style={{ padding: 16, display: "grid", gap: 10 }}>
        <span className="tv-kicker">Install on your phone</span>
        <p className="tv-hint">
          <strong style={{ color: "var(--tv-ink)" }}>iPhone / iPad:</strong> open this page in Safari, tap Share, then
          &ldquo;Add to Home Screen&rdquo;.
          <br />
          <strong style={{ color: "var(--tv-ink)" }}>Android:</strong> open in Chrome, tap the menu, then
          &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.
        </p>
        <p className="tv-hint">
          Your phone and laptop must be on the same Wi-Fi, and you open the laptop&rsquo;s address (for example
          <code style={{ color: "var(--tv-accent)" }}> http://192.168.1.20:3005/tv</code>) rather than localhost.
        </p>
      </section>

      <section className="tv-panel" style={{ padding: 16, display: "grid", gap: 10 }}>
        <span className="tv-kicker">What this app does and doesn&rsquo;t do</span>
        <p className="tv-hint">
          It plays playlists you choose. It does not unlock, decrypt or resell anyone&rsquo;s channels: free-to-air
          streams work because broadcasters publish them, and a paid service works only if you already pay for it.
          Anything else is someone else&rsquo;s copyright, and worth neither the legal risk nor the takedown.
        </p>
      </section>
    </div>
  );
}
