/* Stream proxy.
 *
 * Why this exists: a browser can only play an HLS stream if the stream's host
 * sends CORS headers, and most broadcast CDNs do not. Without a proxy, roughly
 * half the free channels fail with an opaque network error. So manifests are
 * fetched here, their inner URLs rewritten to point back at this route, and
 * segments passed straight through.
 *
 * It is a personal-use proxy, not an open relay:
 *   • private/loopback/metadata addresses are blocked (see lib/tv/net.ts)
 *   • GET only, no caching of media, no credentials forwarded
 *   • disabled in production unless TV_PROXY_ENABLED=true is set explicitly,
 *     so deploying the app does not hand the internet a free relay.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertFetchableUrl, BlockedUrlError, proxyEnabled, upstreamHeaders } from "@/lib/tv/net";
import { isManifest, rewriteManifest } from "@/lib/tv/hls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 20_000;
const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  if (!proxyEnabled()) {
    return NextResponse.json(
      { error: "The stream proxy is disabled on this deployment. Set TV_PROXY_ENABLED=true to turn it on." },
      { status: 403 },
    );
  }

  const target = req.nextUrl.searchParams.get("u");
  const ua = req.nextUrl.searchParams.get("ua");
  const ref = req.nextUrl.searchParams.get("ref");

  if (!target) return NextResponse.json({ error: "Missing stream URL." }, { status: 400 });

  let url: URL;
  try {
    url = await assertFetchableUrl(target);
  } catch (err) {
    const message = err instanceof BlockedUrlError ? err.message : "That URL could not be used.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers: upstreamHeaders({ userAgent: ua, referer: ref, range: req.headers.get("range") }),
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `The stream host replied ${upstream.status}.` },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const contentType = upstream.headers.get("content-type");
    /* Redirects are followed, so rewrite against the URL we actually landed on. */
    const finalUrl = new URL(upstream.url || url.toString());

    if (isManifest(contentType, finalUrl.pathname)) {
      const raw = await upstream.text();
      if (raw.length > MANIFEST_MAX_BYTES) {
        return NextResponse.json({ error: "That playlist is too large to proxy." }, { status: 413 });
      }
      const rewritten = rewriteManifest(raw, finalUrl, ua, ref);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    /* Media segment (or anything else): stream it through untouched. */
    const headers = new Headers({
      "Content-Type": contentType ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    for (const key of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "The stream host timed out." : "Could not reach the stream host." },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
