/* Fetch and parse an M3U playlist.
 *
 * Done server-side for two reasons: most playlist hosts send no CORS headers,
 * and parsing a 10 MB playlist is cheaper here than in a phone browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseM3U } from "@/lib/tv/m3u";
import { assertFetchableUrl, BlockedUrlError, upstreamHeaders } from "@/lib/tv/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Playlists can be big, but not unbounded. 24 MB covers the full world index. */
const MAX_BYTES = 24 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  const sourceId = req.nextUrl.searchParams.get("sourceId") || "custom";

  if (!raw) {
    return NextResponse.json({ error: "Missing playlist URL." }, { status: 400 });
  }

  let url: URL;
  try {
    url = await assertFetchableUrl(raw);
  } catch (err) {
    const message = err instanceof BlockedUrlError ? err.message : "That URL could not be used.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: upstreamHeaders({}),
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `The playlist host replied ${res.status}. Check the URL or your subscription.` },
        { status: 502 },
      );
    }

    /* Read with a byte ceiling rather than res.text(), so an endless response
       cannot be used to exhaust the server's memory. */
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Empty response from the playlist host." }, { status: 502 });

    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        truncated = true;
        void reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.reduce((acc, c) => {
        const next = new Uint8Array(acc.length + c.length);
        next.set(acc);
        next.set(c, acc.length);
        return next;
      }, new Uint8Array()),
    );

    if (!/#EXTM3U|#EXTINF|^https?:\/\//im.test(text)) {
      return NextResponse.json(
        { error: "That URL did not return a playlist. Expected an M3U file." },
        { status: 422 },
      );
    }

    const channels = parseM3U(text, sourceId);

    if (!channels.length) {
      return NextResponse.json(
        { error: "The playlist loaded but contained no playable channels." },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { channels, count: channels.length, truncated },
      /* Cached briefly: flipping between sources shouldn't re-download 10 MB. */
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "The playlist host took too long to respond." : "Could not reach the playlist host." },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
