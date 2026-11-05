/* Server-side URL safety for the two TV API routes.
 *
 * Both routes fetch a URL the browser handed them, which is textbook SSRF
 * territory: without a check, anyone who can reach the app could use it to read
 * `http://localhost:3005/api/...`, a database on the LAN, or a cloud metadata
 * endpoint. So every outbound URL is validated here, and the hostname is
 * resolved first so a DNS name pointing at 127.0.0.1 is rejected too.
 */

import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

export class BlockedUrlError extends Error {}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Private, loopback, link-local and other ranges no public stream lives in. */
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  if (/^f[cd]/.test(v)) return true; // unique local
  /* IPv4-mapped (::ffff:127.0.0.1) — judge by the embedded v4 address. */
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // not an IP we understand — refuse
}

/**
 * Validate a user-supplied URL for server-side fetching.
 *
 * @throws BlockedUrlError with a message safe to show the user.
 */
export async function assertFetchableUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("That is not a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedUrlError("Only http and https URLs can be loaded.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  /* A literal IP needs no DNS round trip. */
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedUrlError("That address is on a private network.");
    return url;
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new BlockedUrlError("That address is on a private network.");
  }

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("That host could not be found.");
  }

  if (!records.length) throw new BlockedUrlError("That host could not be found.");
  if (records.some((r) => isPrivateAddress(r.address))) {
    throw new BlockedUrlError("That address resolves to a private network.");
  }

  return url;
}

/** Headers to send upstream. Many IPTV hosts reject a default fetch UA. */
export function upstreamHeaders(opts: {
  userAgent?: string | null;
  referer?: string | null;
  range?: string | null;
}): HeadersInit {
  const h: Record<string, string> = {
    "User-Agent": opts.userAgent?.slice(0, 300) || "VLC/3.0.20 LibVLC/3.0.20",
    Accept: "*/*",
  };
  if (opts.referer) h.Referer = opts.referer.slice(0, 500);
  if (opts.range) h.Range = opts.range;
  return h;
}

/** Is the TV proxy allowed to run? Off by default in production deploys. */
export function proxyEnabled(): boolean {
  const flag = process.env.TV_PROXY_ENABLED;
  if (flag != null) return flag === "true" || flag === "1";
  return process.env.NODE_ENV !== "production";
}
