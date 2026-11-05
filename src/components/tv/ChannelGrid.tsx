"use client";

/* The channel grid and the player it opens.
 *
 * Shared by Browse and Favourites so both pages get identical behaviour: tap a
 * card to watch, arrow keys move through the list you were looking at, and the
 * star toggles a favourite without opening the channel.
 */

import { useCallback, useMemo, useState } from "react";
import { useTv } from "@/lib/tv/store";
import { flag } from "@/lib/tv/sources";
import type { Channel } from "@/lib/tv/types";
import { Player } from "./Player";

function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "TV";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Card({ channel, onPlay }: { channel: Channel; onPlay: () => void }) {
  const { isFavorite, toggleFavorite, state } = useTv();
  const fav = isFavorite(channel.id);
  const dead = Boolean(state.dead[channel.id]);
  /* Plenty of logo URLs in public playlists are dead. Falling back to initials
     keeps the grid looking deliberate instead of showing empty grey boxes. */
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(channel.logo) && !logoFailed;

  return (
    <div className="tv-card">
      <button
        className="tv-star"
        data-on={fav}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${channel.name} from favourites` : `Add ${channel.name} to favourites`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(channel.id);
        }}
      >
        {fav ? "★" : "☆"}
      </button>

      <button onClick={onPlay} className="tv-card-body" aria-label={`Watch ${channel.name}`}>
        <span className="tv-thumb">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos come from arbitrary broadcaster hosts
            <img src={channel.logo} alt="" loading="lazy" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="tv-thumb-fallback">{initials(channel.name)}</span>
          )}
        </span>
        <span className="tv-card-name">{channel.name}</span>
        <span className="tv-card-sub">
          {dead ? null : <span className="tv-live-dot" aria-hidden />}
          {dead ? "Failed last time" : [flag(channel.country), channel.group].filter(Boolean).join(" ") || "Live"}
        </span>
      </button>
    </div>
  );
}

export function ChannelGrid({
  channels,
  emptyTitle = "Nothing here yet",
  emptyBody,
}: {
  channels: Channel[];
  emptyTitle?: string;
  emptyBody?: React.ReactNode;
}) {
  const { pushRecent } = useTv();
  const [index, setIndex] = useState<number | null>(null);
  /* Render a window of the list: a 10,000-channel playlist would otherwise put
     10,000 DOM nodes on a phone and freeze it. */
  const [limit, setLimit] = useState(120);

  const visible = useMemo(() => channels.slice(0, limit), [channels, limit]);
  const current = index != null ? channels[index] : null;

  const open = useCallback(
    (i: number) => {
      setIndex(i);
      const channel = channels[i];
      if (channel) pushRecent(channel);
    },
    [channels, pushRecent],
  );

  /* The next index is worked out here rather than inside a setState updater:
     an updater runs during render, and calling pushRecent from there updates
     the store mid-render, which React rightly refuses. */
  const step = useCallback(
    (delta: number) => {
      if (index == null || !channels.length) return;
      const next = (index + delta + channels.length) % channels.length;
      setIndex(next);
      const channel = channels[next];
      if (channel) pushRecent(channel);
    },
    [index, channels, pushRecent],
  );

  if (!channels.length) {
    return (
      <div className="tv-empty">
        <div className="tv-display" style={{ fontSize: 15 }}>
          {emptyTitle}
        </div>
        {emptyBody ? <p>{emptyBody}</p> : null}
      </div>
    );
  }

  return (
    <>
      <div className="tv-grid">
        {visible.map((channel, i) => (
          <Card key={channel.id} channel={channel} onPlay={() => open(i)} />
        ))}
      </div>

      {channels.length > visible.length ? (
        <div style={{ display: "grid", placeItems: "center", marginTop: 20 }}>
          <button className="tv-btn" onClick={() => setLimit((l) => l + 240)}>
            Show more ({(channels.length - visible.length).toLocaleString()} left)
          </button>
        </div>
      ) : null}

      {current ? (
        <Player
          channel={current}
          onClose={() => setIndex(null)}
          onNext={channels.length > 1 ? () => step(1) : undefined}
          onPrev={channels.length > 1 ? () => step(-1) : undefined}
        />
      ) : null}
    </>
  );
}
