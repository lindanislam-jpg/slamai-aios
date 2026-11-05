"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTv } from "@/lib/tv/store";
import { ChannelGrid } from "@/components/tv/ChannelGrid";
import { useSearch } from "@/components/tv/Shell";
import type { Channel } from "@/lib/tv/types";

export default function FavoritesPage() {
  const { channels, state, load } = useTv();
  const { query } = useSearch();

  /* Favourites are stored as ids, so they survive a playlist reshuffle but go
     quiet if the source that held them is disabled — which is the honest
     behaviour: the channel genuinely is not available right now. */
  const favorites = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.favorites
      .map((id) => channels.find((c) => c.id === id))
      .filter((c): c is Channel => Boolean(c));
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [state.favorites, channels, query]);

  const missing = state.favorites.length - favorites.length;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div className="tv-display" style={{ fontSize: 19 }}>
          Favourites
        </div>
        <p className="tv-hint" style={{ marginTop: 4 }}>
          {state.favorites.length
            ? `${state.favorites.length} saved. Tap the star on any channel to add or remove it.`
            : "Tap the star on any channel to pin it here."}
        </p>
      </div>

      {missing > 0 && !query ? (
        <div className="tv-note">
          <span aria-hidden>ℹ</span>
          <div>
            {missing} {missing === 1 ? "favourite is" : "favourites are"} not loaded right now — their source is
            switched off or still loading.{" "}
            <Link href="/tv/sources" style={{ color: "var(--tv-accent)" }}>
              Check sources
            </Link>
          </div>
        </div>
      ) : null}

      <ChannelGrid
        channels={favorites}
        emptyTitle={load.loading ? "Loading…" : "No favourites yet"}
        emptyBody={
          load.loading
            ? "Waiting for your playlists."
            : "Open Browse, find a channel you watch often, and tap its star."
        }
      />
    </div>
  );
}
