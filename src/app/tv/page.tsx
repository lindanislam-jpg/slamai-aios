"use client";

/* Browse: search, filter, watch.
 *
 * Filters are derived from whatever the loaded playlists actually contain, so
 * the chips never promise a country or genre that has no channels behind it.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTv } from "@/lib/tv/store";
import { countBy } from "@/lib/tv/m3u";
import { flag, pretty } from "@/lib/tv/sources";
import type { Channel } from "@/lib/tv/types";
import { ChannelGrid } from "@/components/tv/ChannelGrid";
import { useSearch } from "@/components/tv/Shell";

type Dimension = "group" | "country" | "language";

const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: "group", label: "Genre" },
  { id: "country", label: "Country" },
  { id: "language", label: "Language" },
];

export default function BrowsePage() {
  const { channels, load, state, reload } = useTv();
  const { query } = useSearch();
  const [dimension, setDimension] = useState<Dimension>("group");
  const [value, setValue] = useState<string | null>(null);

  /* Only offer a dimension the loaded playlists actually carry. Public
     playlists have genres and (via tvg-id) countries but no language data,
     while a provider's own playlist often has all three — so this is decided
     from the data rather than assumed. */
  const available = useMemo(
    () => DIMENSIONS.filter((d) => channels.some((c) => c[d.id])),
    [channels],
  );

  const activeDimension = useMemo(
    () => (available.some((d) => d.id === dimension) ? dimension : (available[0]?.id ?? "group")),
    [available, dimension],
  );

  const facets = useMemo(
    () => countBy(channels, activeDimension).slice(0, 40),
    [channels, activeDimension],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (value && c[activeDimension] !== value) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.group?.toLowerCase().includes(q) ?? false) ||
        (c.country?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [channels, query, activeDimension, value]);

  const recents = useMemo(() => {
    const found = state.recents
      .map((r) => channels.find((c) => c.id === r.channelId))
      .filter((c): c is Channel => Boolean(c));
    return found.slice(0, 12);
  }, [state.recents, channels]);

  const sourceErrors = Object.entries(load.errors);
  const enabledCount = state.sources.filter((s) => s.enabled).length;

  /* ---- first run / nothing to show ---- */
  if (!enabledCount) {
    return (
      <div className="tv-empty">
        <div className="tv-display" style={{ fontSize: 17 }}>
          No channel sources yet
        </div>
        <p>
          Add a free worldwide playlist — news, sport, films, by country or language — or point the app at a
          subscription you already pay for.
        </p>
        <Link href="/tv/sources" className="tv-btn tv-btn-primary" style={{ marginTop: 6 }}>
          Add channels
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ---- loading skeleton ---- */}
      {load.loading && !channels.length ? (
        <div>
          <div className="tv-kicker" style={{ marginBottom: 12 }}>
            Loading channels
          </div>
          <div className="tv-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="tv-skeleton" />
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- per-source failures, stated plainly ---- */}
      {sourceErrors.length ? (
        <div className="tv-note">
          <span aria-hidden>⚠</span>
          <div>
            {sourceErrors.map(([id, err]) => {
              const label = state.sources.find((s) => s.id === id)?.label ?? id;
              return (
                <div key={id}>
                  <strong>{label}</strong> — {err}
                </div>
              );
            })}
            <button className="tv-btn tv-btn-sm" style={{ marginTop: 9 }} onClick={reload}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* ---- continue watching ---- */}
      {recents.length > 0 && !query ? (
        <section>
          <div className="tv-kicker" style={{ marginBottom: 10 }}>
            Jump back in
          </div>
          <ChannelGrid channels={recents} />
        </section>
      ) : null}

      {/* ---- filters ---- */}
      {channels.length ? (
        <section style={{ display: "grid", gap: 10 }}>
          {available.length > 1 ? (
            <div className="tv-chips">
              {available.map((d) => (
                <button
                  key={d.id}
                  className="tv-chip"
                  data-active={activeDimension === d.id}
                  onClick={() => {
                    setDimension(d.id);
                    setValue(null);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="tv-chips">
            <button className="tv-chip" data-active={value === null} onClick={() => setValue(null)}>
              All ({channels.length.toLocaleString()})
            </button>
            {facets.map(([facet, count]) => (
              <button
                key={facet}
                className="tv-chip"
                data-active={value === facet}
                onClick={() => setValue(value === facet ? null : facet)}
              >
                {activeDimension === "country" ? `${flag(facet)} ${facet.toUpperCase()}` : pretty(facet)} ({count})
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- the grid ---- */}
      <section>
        {query || value ? (
          <div className="tv-kicker" style={{ marginBottom: 10 }}>
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "channel" : "channels"}
            {value ? ` · ${activeDimension === "country" ? value.toUpperCase() : pretty(value)}` : ""}
          </div>
        ) : null}

        <ChannelGrid
          channels={filtered}
          emptyTitle={load.loading ? "Loading…" : "No channels match"}
          emptyBody={
            load.loading
              ? "Fetching the playlists you enabled."
              : "Try a different search, clear the filter, or add another source."
          }
        />
      </section>
    </div>
  );
}
