"use client";

/* SlamAI TV state.
 *
 * Everything lives in localStorage on the device — no account, no database, no
 * server-side record of what anyone watched. Channels themselves are fetched
 * fresh from each source and held in memory only, because playlists change
 * daily and a stale cached copy is worse than a two-second load.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { CATALOG_ENTRIES, STARTER_SOURCE_IDS } from "./sources";
import {
  DEFAULT_TV_SETTINGS,
  TV_STATE_VERSION,
  TV_STORAGE_KEY,
  type Channel,
  type Recent,
  type Source,
  type TvSettings,
  type TvState,
} from "./types";

/* ------------------------------------------------------------------ *
 * Initial state
 * ------------------------------------------------------------------ */

function starterSources(): Source[] {
  const out: Source[] = [];
  STARTER_SOURCE_IDS.forEach((id, i) => {
    const entry = CATALOG_ENTRIES.find((e) => e.id === id);
    if (!entry) return;
    out.push({
      id: entry.id,
      label: entry.label,
      url: entry.url,
      kind: "catalog",
      addedAt: Date.now() + i,
      enabled: true,
    });
  });
  return out;
}

function createInitialState(): TvState {
  return {
    version: TV_STATE_VERSION,
    sources: starterSources(),
    favorites: [],
    recents: [],
    dead: {},
    settings: { ...DEFAULT_TV_SETTINGS },
  };
}

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

type Action =
  | { type: "hydrate"; state: TvState }
  | { type: "addSource"; source: Source }
  | { type: "removeSource"; id: string }
  | { type: "toggleSource"; id: string }
  | { type: "toggleFavorite"; channelId: string }
  | { type: "pushRecent"; recent: Recent }
  | { type: "markDead"; channelId: string }
  | { type: "clearDead" }
  | { type: "settings"; patch: Partial<TvSettings> }
  | { type: "reset" };

function reducer(state: TvState, action: Action): TvState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "addSource": {
      /* Re-adding an existing source should re-enable it, not duplicate it. */
      const existing = state.sources.find(
        (s) => s.id === action.source.id || s.url === action.source.url,
      );
      if (existing) {
        return {
          ...state,
          sources: state.sources.map((s) =>
            s.id === existing.id ? { ...s, enabled: true, label: action.source.label } : s,
          ),
        };
      }
      return { ...state, sources: [...state.sources, action.source] };
    }

    case "removeSource":
      return {
        ...state,
        sources: state.sources.filter((s) => s.id !== action.id),
        /* Favourites and history from a removed source are dead weight. */
        favorites: state.favorites.filter((f) => !f.startsWith(`${action.id}:`)),
        recents: state.recents.filter((r) => !r.channelId.startsWith(`${action.id}:`)),
      };

    case "toggleSource":
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.id ? { ...s, enabled: !s.enabled } : s)),
      };

    case "toggleFavorite":
      return {
        ...state,
        favorites: state.favorites.includes(action.channelId)
          ? state.favorites.filter((f) => f !== action.channelId)
          : [action.channelId, ...state.favorites],
      };

    case "pushRecent":
      return {
        ...state,
        recents: [action.recent, ...state.recents.filter((r) => r.channelId !== action.recent.channelId)].slice(0, 24),
      };

    case "markDead":
      return { ...state, dead: { ...state.dead, [action.channelId]: Date.now() } };

    case "clearDead":
      return { ...state, dead: {} };

    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "reset":
      return createInitialState();

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Channel loading
 * ------------------------------------------------------------------ */

interface LoadState {
  loading: boolean;
  /** sourceId → human-readable failure, shown inline rather than as a toast. */
  errors: Record<string, string>;
}

interface TvContextValue {
  state: TvState;
  ready: boolean;
  /** Channels from every enabled source, deduplicated. */
  channels: Channel[];
  load: LoadState;
  reload: () => void;
  addCatalogSource: (catalogId: string) => void;
  addCustomSource: (label: string, url: string) => void;
  addXtreamSource: (label: string, host: string, username: string, password: string) => void;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  toggleFavorite: (channelId: string) => void;
  isFavorite: (channelId: string) => boolean;
  pushRecent: (channel: Channel) => void;
  markDead: (channelId: string) => void;
  clearDead: () => void;
  updateSettings: (patch: Partial<TvSettings>) => void;
  reset: () => void;
  /** Resolve the URL the <video> element should actually load. */
  playbackUrl: (channel: Channel) => string;
}

const TvContext = createContext<TvContextValue | null>(null);

export function TvProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const [ready, setReady] = useState(false);
  const [channelsBySource, setChannelsBySource] = useState<Record<string, Channel[]>>({});
  const [load, setLoad] = useState<LoadState>({ loading: false, errors: {} });
  const [nonce, setNonce] = useState(0);
  /* Guards against a slow fetch from a removed source writing stale channels. */
  const runRef = useRef(0);

  /* ---- hydrate once on the client ---- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TV_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TvState;
        if (parsed && parsed.version === TV_STATE_VERSION && Array.isArray(parsed.sources)) {
          dispatch({
            type: "hydrate",
            state: { ...createInitialState(), ...parsed, settings: { ...DEFAULT_TV_SETTINGS, ...parsed.settings } },
          });
        }
      }
    } catch {
      /* Corrupt or blocked storage: fall back to a fresh state rather than crash. */
    }
    setReady(true);
  }, []);

  /* ---- persist ---- */
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(TV_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Private mode / full quota — the app still works for this session. */
    }
  }, [state, ready]);

  /* ---- fetch channels for every enabled source ---- */
  const enabled = useMemo(
    () => state.sources.filter((s) => s.enabled).map((s) => ({ id: s.id, url: s.url })),
    [state.sources],
  );
  const enabledKey = useMemo(() => enabled.map((s) => `${s.id}|${s.url}`).join("~"), [enabled]);

  useEffect(() => {
    if (!ready) return;
    if (!enabled.length) {
      setChannelsBySource({});
      setLoad({ loading: false, errors: {} });
      return;
    }

    const run = ++runRef.current;
    let cancelled = false;
    setLoad({ loading: true, errors: {} });

    (async () => {
      const results = await Promise.all(
        enabled.map(async (source) => {
          try {
            const res = await fetch(
              `/api/tv/playlist?url=${encodeURIComponent(source.url)}&sourceId=${encodeURIComponent(source.id)}`,
            );
            const body = (await res.json()) as { channels?: Channel[]; error?: string };
            if (!res.ok) return { id: source.id, error: body.error ?? `Failed (${res.status})` };
            return { id: source.id, channels: body.channels ?? [] };
          } catch {
            return { id: source.id, error: "No connection to the app server." };
          }
        }),
      );

      if (cancelled || run !== runRef.current) return;

      const next: Record<string, Channel[]> = {};
      const errors: Record<string, string> = {};
      for (const r of results) {
        if ("error" in r && r.error) errors[r.id] = r.error;
        else if ("channels" in r && r.channels) next[r.id] = r.channels;
      }
      setChannelsBySource(next);
      setLoad({ loading: false, errors });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabledKey, ready, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- derived channel list ---- */
  const channels = useMemo(() => {
    const order = state.sources.filter((s) => s.enabled).map((s) => s.id);
    const all = order.flatMap((id) => channelsBySource[id] ?? []);
    if (!state.settings.hideDead) return all;
    return all.filter((c) => !state.dead[c.id]);
  }, [channelsBySource, state.sources, state.settings.hideDead, state.dead]);

  /* ---- actions ---- */
  const addCatalogSource = useCallback((catalogId: string) => {
    const entry = CATALOG_ENTRIES.find((e) => e.id === catalogId);
    if (!entry) return;
    dispatch({
      type: "addSource",
      source: { id: entry.id, label: entry.label, url: entry.url, kind: "catalog", addedAt: Date.now(), enabled: true },
    });
  }, []);

  const addCustomSource = useCallback((label: string, url: string) => {
    dispatch({
      type: "addSource",
      source: {
        id: `custom-${Date.now().toString(36)}`,
        label: label.trim() || "My playlist",
        url: url.trim(),
        kind: "custom",
        addedAt: Date.now(),
        enabled: true,
      },
    });
  }, []);

  const addXtreamSource = useCallback(
    (label: string, host: string, username: string, password: string) => {
      /* Imported lazily to keep the URL-building rules in one place (m3u.ts). */
      void import("./m3u").then(({ xtreamPlaylistUrl }) => {
        let url: string;
        try {
          url = xtreamPlaylistUrl(host, username, password);
        } catch {
          return;
        }
        dispatch({
          type: "addSource",
          source: {
            id: `xtream-${Date.now().toString(36)}`,
            label: label.trim() || "My provider",
            url,
            kind: "xtream",
            addedAt: Date.now(),
            enabled: true,
            xtream: { host: host.trim(), username: username.trim() },
          },
        });
      });
    },
    [],
  );

  const pushRecent = useCallback((channel: Channel) => {
    dispatch({
      type: "pushRecent",
      recent: { channelId: channel.id, name: channel.name, url: channel.url, logo: channel.logo, at: Date.now() },
    });
  }, []);

  const playbackUrl = useCallback(
    (channel: Channel) => {
      if (!state.settings.useProxy) return channel.url;
      const params = new URLSearchParams({ u: channel.url });
      if (channel.userAgent) params.set("ua", channel.userAgent);
      if (channel.referer) params.set("ref", channel.referer);
      return `/api/tv/proxy?${params.toString()}`;
    },
    [state.settings.useProxy],
  );

  const value = useMemo<TvContextValue>(
    () => ({
      state,
      ready,
      channels,
      load,
      reload: () => setNonce((n) => n + 1),
      addCatalogSource,
      addCustomSource,
      addXtreamSource,
      removeSource: (id) => dispatch({ type: "removeSource", id }),
      toggleSource: (id) => dispatch({ type: "toggleSource", id }),
      toggleFavorite: (channelId) => dispatch({ type: "toggleFavorite", channelId }),
      isFavorite: (channelId) => state.favorites.includes(channelId),
      pushRecent,
      markDead: (channelId) => dispatch({ type: "markDead", channelId }),
      clearDead: () => dispatch({ type: "clearDead" }),
      updateSettings: (patch) => dispatch({ type: "settings", patch }),
      reset: () => dispatch({ type: "reset" }),
      playbackUrl,
    }),
    [state, ready, channels, load, addCatalogSource, addCustomSource, addXtreamSource, pushRecent, playbackUrl],
  );

  return <TvContext.Provider value={value}>{children}</TvContext.Provider>;
}

export function useTv(): TvContextValue {
  const ctx = useContext(TvContext);
  if (!ctx) throw new Error("useTv must be used inside <TvProvider>");
  return ctx;
}
