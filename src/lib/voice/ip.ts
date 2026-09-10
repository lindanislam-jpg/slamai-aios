/**
 * Address classification for the SSRF guard.
 *
 * Kept apart from egress.ts, which is server-only, so this can be unit tested
 * outside Next — it is the part that has to be exactly right, and an untested
 * range table is how loopback gets through.
 */

/** Reject anything that is not routable on the public internet. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase();

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) is judged as the IPv4 it carries.
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (ip.includes(":")) return isPrivateIpv6(ip);

  const octets = ip.split(".");
  if (octets.length !== 4) return true;

  const parts = octets.map((o) => Number(o));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;

  if (a === 0) return true;                       // "this network"
  if (a === 10) return true;                      // RFC1918
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;  // carrier-grade NAT
  if (a === 192 && b === 0) return true;          // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                      // multicast and reserved

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  if (bare === "::" || bare === "::1") return true;
  if (bare.startsWith("fe80")) return true;                       // link-local
  if (/^f[cd]/.test(bare)) return true;                           // unique local
  if (bare.startsWith("ff")) return true;                         // multicast
  return false;
}
