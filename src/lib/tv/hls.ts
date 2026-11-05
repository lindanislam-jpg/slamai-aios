/* HLS manifest rewriting.
 *
 * Kept as a pure function in its own module: the proxy route it serves pulls in
 * server-only DNS code, and this logic is the part most worth testing in
 * isolation — if it is wrong, every channel silently fails to play.
 */

/** Build a proxy URL for a nested playlist or segment URL. */
export function proxyUrl(target: string, ua?: string | null, ref?: string | null): string {
  const params = new URLSearchParams({ u: target });
  if (ua) params.set("ua", ua);
  if (ref) params.set("ref", ref);
  return `/api/tv/proxy?${params.toString()}`;
}

/**
 * Rewrite every URL inside an HLS manifest so playback stays on the proxy.
 *
 * Three kinds of reference need handling:
 *   1. bare lines          → variant playlists and media segments
 *   2. URI="…" attributes  → #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
 *   3. relative paths      → resolved against the manifest's own URL first
 */
export function rewriteManifest(
  body: string,
  base: URL,
  ua?: string | null,
  ref?: string | null,
): string {
  const resolve = (value: string) => {
    try {
      return new URL(value, base).toString();
    } catch {
      return null;
    }
  };

  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        /* Rewrite URI="…" in tag attributes, leave the rest of the tag alone. */
        return line.replace(/URI="([^"]+)"/gi, (match, value: string) => {
          const abs = resolve(value);
          return abs ? `URI="${proxyUrl(abs, ua, ref)}"` : match;
        });
      }

      const abs = resolve(trimmed);
      return abs ? proxyUrl(abs, ua, ref) : line;
    })
    .join("\n");
}

/** Does this response look like an HLS manifest rather than a media segment? */
export function isManifest(contentType: string | null, pathname: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("mpegurl") || ct.includes("m3u")) return true;
  return /\.m3u8?($|\?)/i.test(pathname);
}
