"use client";

/* App chrome: header + search on the laptop, a thumb-reachable tab bar on the
 * phone. Search is held in a context so the header can drive the grid on the
 * Browse page without prop-drilling through the layout.
 */

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTv } from "@/lib/tv/store";

const NAV = [
  { href: "/tv", label: "Browse", icon: "▦" },
  { href: "/tv/favorites", label: "Favourites", icon: "★" },
  { href: "/tv/sources", label: "Sources", icon: "＋" },
  { href: "/tv/settings", label: "Settings", icon: "⚙" },
] as const;

const SearchContext = createContext<{ query: string; setQuery: (v: string) => void }>({
  query: "",
  setQuery: () => undefined,
});

export function useSearch() {
  return useContext(SearchContext);
}

function Header({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  const pathname = usePathname();
  const { channels, load } = useTv();

  return (
    <header className="tv-header">
      <div className="tv-header-row">
        <Link href="/tv" className="tv-logo">
          <span className="tv-logo-mark" aria-hidden>
            ▶
          </span>
          <span className="hidden sm:inline">SlamAI TV</span>
        </Link>

        <nav className="tv-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="tv-nav-link"
              data-active={item.href === "/tv" ? pathname === "/tv" : pathname.startsWith(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <label className="tv-search">
          <span aria-hidden style={{ color: "var(--tv-ink-4)", fontSize: 13 }}>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              load.loading
                ? "Loading channels…"
                : channels.length
                  ? `Search ${channels.length.toLocaleString()} channels`
                  : "Search channels"
            }
            aria-label="Search channels"
            autoComplete="off"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear search" style={{ color: "var(--tv-ink-4)" }}>
              ✕
            </button>
          ) : null}
        </label>
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tv-tabbar">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="tv-tab"
          data-active={item.href === "/tv" ? pathname === "/tv" : pathname.startsWith(item.href)}
        >
          <span aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Boot() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh", position: "relative" }}>
      <div className="tv-canvas" />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div className="tv-logo-mark" style={{ margin: "0 auto 14px", height: 44, width: 44, fontSize: 20 }}>
          ▶
        </div>
        <div className="tv-display" style={{ fontSize: 15 }}>
          SlamAI TV
        </div>
        <div className="tv-kicker" style={{ marginTop: 6 }}>
          Loading your channels
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready } = useTv();
  const [query, setQuery] = useState("");

  /* Register the service worker so the app installs to a home screen. */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/tv-sw.js", { scope: "/tv" }).catch(() => undefined);
  }, []);

  return (
    <div data-tv="" style={{ minHeight: "100dvh" }}>
      {ready ? (
        <SearchContext.Provider value={{ query, setQuery }}>
          <div className="tv-canvas" />
          <div className="tv-shell">
            <Header query={query} setQuery={setQuery} />
            <main className="tv-main">{children}</main>
          </div>
          <TabBar />
        </SearchContext.Provider>
      ) : (
        <Boot />
      )}
    </div>
  );
}
