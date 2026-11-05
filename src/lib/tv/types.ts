/* SlamAI TV — shared types.
 *
 * The whole module is a *player*. It owns no content: every channel comes from
 * a playlist the user chose, either one of the free public playlists in
 * `sources.ts` or a URL they pasted in themselves.
 */

export const TV_STORAGE_KEY = "slamai.tv.v1";
export const TV_STATE_VERSION = 1;

/** One playable channel, parsed out of an M3U playlist. */
export interface Channel {
  /** Stable id: `${sourceId}:${tvgId || name}` — survives playlist reordering. */
  id: string;
  /** Which source (playlist) this channel came from. */
  sourceId: string;
  name: string;
  url: string;
  logo?: string;
  /** `group-title` from the playlist — usually a genre ("News", "Sports"). */
  group?: string;
  /** ISO-3166 alpha-2, lowercase, when the playlist tells us. */
  country?: string;
  /** ISO-639 language code when the playlist tells us. */
  language?: string;
  tvgId?: string;
  /** Headers some providers require (`#EXTVLCOPT:http-user-agent=…`). */
  userAgent?: string;
  referer?: string;
}

/** A playlist the user has added. */
export interface Source {
  id: string;
  label: string;
  /** M3U/M3U8 playlist URL. */
  url: string;
  /** `catalog` = one of ours, `custom` = the user pasted it, `xtream` = built from a provider login. */
  kind: "catalog" | "custom" | "xtream";
  addedAt: number;
  /** Set for `xtream` so Sources can show the account without re-deriving it. */
  xtream?: { host: string; username: string };
  enabled: boolean;
}

export interface Recent {
  channelId: string;
  name: string;
  url: string;
  logo?: string;
  at: number;
}

export interface TvSettings {
  /** Route playback through /api/tv/proxy. Needed for most streams (CORS). */
  useProxy: boolean;
  /** Remember where you left off and offer to resume. */
  resumeLast: boolean;
  /** Hide channels whose stream failed to load last time. */
  hideDead: boolean;
  /** Preferred country filter on first load, e.g. "gb". */
  homeCountry?: string;
}

export interface TvState {
  version: number;
  sources: Source[];
  favorites: string[];
  recents: Recent[];
  /** channelId → last time playback failed. Used by `hideDead`. */
  dead: Record<string, number>;
  settings: TvSettings;
}

export const DEFAULT_TV_SETTINGS: TvSettings = {
  useProxy: true,
  resumeLast: true,
  hideDead: false,
};
