/* M3U / M3U8 playlist parser.
 *
 * Extended M3U is a loose, de-facto format, so this parser is deliberately
 * forgiving: it reads what it recognises and ignores the rest rather than
 * throwing away a 10,000-channel playlist over one malformed line.
 *
 * A channel looks like this in the wild:
 *
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="BBCNews.uk" tvg-logo="https://…/bbc.png" \
 *            group-title="News" tvg-country="UK" tvg-language="English",BBC News
 *   #EXTVLCOPT:http-user-agent=Mozilla/5.0
 *   https://example.com/bbcnews/index.m3u8
 */

import type { Channel } from "./types";

/** Pull `key="value"` pairs out of an #EXTINF attribute string. */
function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z0-9_-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** "UK" / "uk;ie" / "United Kingdom" → "uk" (first code only, lowercased). */
function country(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(/[;,]/)[0]?.trim();
  if (!first) return undefined;
  return first.length === 2 ? first.toLowerCase() : first.toLowerCase().slice(0, 2);
}

function language(raw?: string): string | undefined {
  const first = raw?.split(/[;,]/)[0]?.trim();
  return first ? first.toLowerCase() : undefined;
}

/**
 * Recover a country code from a tvg-id.
 *
 * Large public playlists have stopped emitting `tvg-country`, but they encode
 * the country in the id instead: `5USA.uk@SD`, `AajTak.in@HD`, `00sReplay.us`.
 * Without this the country filter and the flags are empty on real data.
 */
function countryFromTvgId(tvgId?: string): string | undefined {
  if (!tvgId) return undefined;
  const m = /\.([A-Za-z]{2})(?:@|$)/.exec(tvgId);
  return m ? m[1].toLowerCase() : undefined;
}

/**
 * Parse an extended M3U playlist into channels.
 *
 * @param text      raw playlist body
 * @param sourceId  id of the source it came from, used to namespace channel ids
 * @param limit     hard cap so a hostile or huge playlist cannot exhaust memory
 */
export function parseM3U(text: string, sourceId: string, limit = 20_000): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  const seen = new Set<string>();

  let pending: Partial<Channel> | null = null;
  /* A group named by #EXTGRP before its #EXTINF line. */
  let pendingGroup: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const a = attrs(line);
      /* Display name is everything after the last comma on the EXTINF line. */
      const comma = line.lastIndexOf(",");
      const name = (comma >= 0 ? line.slice(comma + 1) : "").trim();
      const tvgId = a["tvg-id"] || undefined;
      pending = {
        name: name || a["tvg-name"] || "Unnamed channel",
        logo: a["tvg-logo"] || undefined,
        group: a["group-title"] || pendingGroup,
        /* Explicit attribute first, then the country encoded in the id. */
        country: country(a["tvg-country"]) ?? countryFromTvgId(tvgId),
        language: language(a["tvg-language"]),
        tvgId,
        /* Playback headers appear either as EXTINF attributes (below) or as
           #EXTVLCOPT lines (handled further down). Playlists use both. */
        userAgent: a["http-user-agent"] || undefined,
        referer: a["http-referrer"] || a["http-referer"] || undefined,
      };
      continue;
    }

    /* Per-channel playback options. Only the two that matter for playback.
       Everything after the FIRST colon is the value — splitting on every colon
       would truncate "http-referrer=https://…" at the scheme. */
    if (line.startsWith("#EXTVLCOPT") && pending) {
      const value = line.slice(line.indexOf(":") + 1);
      const eq = value.indexOf("=");
      if (eq > 0) {
        const key = value.slice(0, eq).trim();
        const v = value.slice(eq + 1).trim();
        if (key === "http-user-agent") pending.userAgent = v;
        if (key === "http-referrer" || key === "http-referer") pending.referer = v;
      }
      continue;
    }

    /* #EXTGRP appears on either side of its #EXTINF depending on who wrote the
       playlist, so it is remembered and applied to whichever entry needs it. */
    if (line.startsWith("#EXTGRP")) {
      const group = line.slice(line.indexOf(":") + 1).trim() || undefined;
      if (pending) {
        if (!pending.group) pending.group = group;
      } else {
        pendingGroup = group;
      }
      continue;
    }

    if (line.startsWith("#")) continue; // any other directive

    /* A non-comment line is the stream URL, which closes the current entry. */
    if (!/^https?:\/\//i.test(line)) {
      pending = null;
      pendingGroup = undefined;
      continue;
    }

    const base = pending ?? { name: line };
    const id = `${sourceId}:${base.tvgId || base.name || line}`;
    if (!seen.has(id)) {
      seen.add(id);
      channels.push({
        id,
        sourceId,
        name: base.name || "Unnamed channel",
        url: line,
        logo: base.logo,
        group: base.group,
        country: base.country,
        language: base.language,
        tvgId: base.tvgId,
        userAgent: base.userAgent,
        referer: base.referer,
      });
    }
    pending = null;
    pendingGroup = undefined;

    if (channels.length >= limit) break;
  }

  return channels;
}

/**
 * Build the M3U URL for an Xtream Codes provider login.
 *
 * Most paid IPTV providers hand out a portal URL plus a username and password;
 * that is the same thing as a playlist URL in this shape. We only *format* it —
 * the user's own subscription does the authorising.
 */
export function xtreamPlaylistUrl(host: string, username: string, password: string): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const u = new URL(withScheme);
  u.pathname = "/get.php";
  u.search = new URLSearchParams({
    username: username.trim(),
    password: password.trim(),
    type: "m3u_plus",
    output: "ts",
  }).toString();
  return u.toString();
}

/** Group channels by a field, sorted by channel count descending. */
export function countBy(channels: Channel[], key: "group" | "country" | "language") {
  const map = new Map<string, number>();
  for (const c of channels) {
    const v = c[key];
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
