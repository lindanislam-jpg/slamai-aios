"use client";

/* Sources: where channels come from.
 *
 * Three ways in, in the order most people need them:
 *   1. the free catalog (no account, no payment, legal to stream)
 *   2. an M3U playlist URL — including one from a service you subscribe to
 *   3. an Xtream Codes provider login, which is just a playlist URL in disguise
 */

import { useMemo, useState } from "react";
import { useTv } from "@/lib/tv/store";
import { CATALOG } from "@/lib/tv/sources";

type Tab = "catalog" | "playlist" | "provider";

export default function SourcesPage() {
  const { state, addCatalogSource, addCustomSource, addXtreamSource, removeSource, toggleSource, load, reload } =
    useTv();
  const [tab, setTab] = useState<Tab>("catalog");

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const added = useMemo(() => new Set(state.sources.map((s) => s.id)), [state.sources]);

  function submitPlaylist() {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setUrlError("Enter a full playlist URL starting with http:// or https://");
      return;
    }
    setUrlError("");
    addCustomSource(label, trimmed);
    setLabel("");
    setUrl("");
  }

  function submitProvider() {
    if (!host.trim() || !username.trim() || !password.trim()) return;
    addXtreamSource(label, host, username, password);
    setLabel("");
    setHost("");
    setUsername("");
    setPassword("");
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div>
        <div className="tv-display" style={{ fontSize: 19 }}>
          Sources
        </div>
        <p className="tv-hint" style={{ marginTop: 4, maxWidth: "62ch" }}>
          This app is a player — it holds no channels of its own. Add a free public playlist below, or point it at a
          subscription you already pay for.
        </p>
      </div>

      {/* ---- what's active ---- */}
      <section className="tv-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="tv-kicker">Active sources</span>
          <button className="tv-btn tv-btn-sm" style={{ marginLeft: "auto" }} onClick={reload} disabled={load.loading}>
            {load.loading ? "Loading…" : "Reload all"}
          </button>
        </div>

        {state.sources.length === 0 ? (
          <p className="tv-hint">Nothing added yet. Pick something from the catalog below.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {state.sources.map((source) => (
              <div
                key={source.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--tv-hair)",
                  background: "var(--tv-panel)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 560 }}>{source.label}</div>
                  <div
                    className="tv-hint"
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {load.errors[source.id] ? (
                      <span style={{ color: "hsl(0 84% 72%)" }}>{load.errors[source.id]}</span>
                    ) : source.kind === "xtream" ? (
                      `Provider · ${source.xtream?.host ?? ""} · ${source.xtream?.username ?? ""}`
                    ) : (
                      source.url
                    )}
                  </div>
                </div>

                <button
                  className="tv-btn tv-btn-sm"
                  onClick={() => toggleSource(source.id)}
                  aria-pressed={source.enabled}
                  title={source.enabled ? "Switch off" : "Switch on"}
                >
                  {source.enabled ? "On" : "Off"}
                </button>
                <button
                  className="tv-btn tv-btn-sm tv-btn-danger"
                  onClick={() => removeSource(source.id)}
                  aria-label={`Remove ${source.label}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- add ---- */}
      <section style={{ display: "grid", gap: 14 }}>
        <div className="tv-chips">
          <button className="tv-chip" data-active={tab === "catalog"} onClick={() => setTab("catalog")}>
            Free catalog
          </button>
          <button className="tv-chip" data-active={tab === "playlist"} onClick={() => setTab("playlist")}>
            Playlist URL
          </button>
          <button className="tv-chip" data-active={tab === "provider"} onClick={() => setTab("provider")}>
            Provider login
          </button>
        </div>

        {tab === "catalog" ? (
          <div style={{ display: "grid", gap: 20 }}>
            <div className="tv-note">
              <span aria-hidden>✓</span>
              <div>
                <strong>Free and legal.</strong> These playlists index channels that broadcasters stream publicly
                themselves, published by the open-source iptv-org project. Nothing here is a paid service.
              </div>
            </div>

            {CATALOG.map((group) => (
              <div key={group.id} style={{ display: "grid", gap: 10 }}>
                <div>
                  <div className="tv-display" style={{ fontSize: 14.5 }}>
                    {group.label}
                  </div>
                  <p className="tv-hint" style={{ marginTop: 2 }}>
                    {group.blurb}
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fill, minmax(236px, 1fr))",
                  }}
                >
                  {group.entries.map((entry) => {
                    const isAdded = added.has(entry.id);
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "11px 12px",
                          borderRadius: 13,
                          border: "1px solid var(--tv-hair)",
                          background: "var(--tv-panel)",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 560 }}>{entry.label}</div>
                          <p className="tv-hint" style={{ marginTop: 3 }}>
                            {entry.note}
                          </p>
                        </div>
                        <button
                          className={isAdded ? "tv-btn tv-btn-sm" : "tv-btn tv-btn-sm tv-btn-primary"}
                          onClick={() => (isAdded ? removeSource(entry.id) : addCatalogSource(entry.id))}
                        >
                          {isAdded ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "playlist" ? (
          <div className="tv-panel" style={{ padding: 16, display: "grid", gap: 14, maxWidth: 620 }}>
            <p className="tv-hint">
              Paste any M3U or M3U8 playlist URL. If you subscribe to a streaming service that gives you one, this is
              where it goes — the app plays what your own subscription allows and stores the URL on this device only.
            </p>
            <div>
              <label className="tv-label" htmlFor="pl-label">
                Name
              </label>
              <input
                id="pl-label"
                className="tv-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My playlist"
              />
            </div>
            <div>
              <label className="tv-label" htmlFor="pl-url">
                Playlist URL
              </label>
              <input
                id="pl-url"
                className="tv-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
              />
              {urlError ? (
                <p className="tv-hint" style={{ color: "hsl(0 84% 72%)", marginTop: 6 }}>
                  {urlError}
                </p>
              ) : null}
            </div>
            <button className="tv-btn tv-btn-primary" onClick={submitPlaylist} style={{ justifySelf: "start" }}>
              Add playlist
            </button>
          </div>
        ) : null}

        {tab === "provider" ? (
          <div className="tv-panel" style={{ padding: 16, display: "grid", gap: 14, maxWidth: 620 }}>
            <p className="tv-hint">
              Most IPTV providers give you a portal address, a username and a password (an &ldquo;Xtream Codes&rdquo;
              login). The app turns those into a playlist URL and plays it. Your details are kept in this browser and
              sent only to your provider.
            </p>
            <div>
              <label className="tv-label" htmlFor="x-label">
                Name
              </label>
              <input
                id="x-label"
                className="tv-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My provider"
              />
            </div>
            <div>
              <label className="tv-label" htmlFor="x-host">
                Portal address
              </label>
              <input
                id="x-host"
                className="tv-input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="http://portal.example.com:8080"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label className="tv-label" htmlFor="x-user">
                  Username
                </label>
                <input
                  id="x-user"
                  className="tv-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="off"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="tv-label" htmlFor="x-pass">
                  Password
                </label>
                <input
                  id="x-pass"
                  className="tv-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              className="tv-btn tv-btn-primary"
              onClick={submitProvider}
              disabled={!host.trim() || !username.trim() || !password.trim()}
              style={{ justifySelf: "start" }}
            >
              Add provider
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
