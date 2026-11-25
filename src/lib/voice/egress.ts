import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit, type Response as UndiciResponse } from "undici";
import { isPrivateAddress } from "./ip";

/**
 * Outbound request safety for URLs a tenant supplies.
 *
 * Two places let a customer point the server at a URL of their choosing:
 * knowledge web sources and notification/webhook targets. Both are classic
 * SSRF surfaces, and the knowledge one is a *full-read* surface — whatever
 * comes back is stored and readable through the API — so a blind-SSRF level
 * of care is not enough.
 *
 * Checking the hostname string is not a control. `169.254.169.254.nip.io` is
 * a perfectly ordinary public name that resolves to link-local; so is any
 * name an attacker registers pointing at RFC1918 space. Numeric spellings
 * are worse: the resolver reads `0177.0.0.1` as octal loopback and
 * `0x7f.1` as hex, neither of which a dotted-quad string check catches.
 *
 * So the rule here is: **resolve first, judge the address, then pin the
 * connection to the address we judged.** Pinning matters because between the
 * check and the connect the name could resolve again to something else
 * (DNS rebinding); undici's `connect.lookup` hook lets us hand the socket the
 * exact address we approved while the TLS SNI and Host header keep the
 * original hostname, so certificates still validate.
 */

export { isPrivateAddress } from "./ip";

export class BlockedAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedAddressError";
  }
}

export type ApprovedTarget = { url: URL; address: string; family: number };

/**
 * Validates a tenant-supplied URL and resolves it to a single approved
 * address. Throws `BlockedAddressError` with a message safe to show a user.
 */
export async function approveUrl(rawUrl: string): Promise<ApprovedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedAddressError("That doesn't look like a valid web address.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedAddressError("Only http and https addresses can be used.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // Obvious internal names, before spending a DNS query on them.
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new BlockedAddressError("That address is not reachable from the public internet.");
  }

  let resolved: { address: string; family: number }[];
  try {
    // `all` matters: a name with several records must be rejected if *any*
    // of them is internal, otherwise the choice of address decides safety.
    resolved = await dnsLookup(hostname, { all: true });
  } catch {
    throw new BlockedAddressError("That address could not be found.");
  }

  if (resolved.length === 0) {
    throw new BlockedAddressError("That address could not be found.");
  }
  if (resolved.some((entry) => isPrivateAddress(entry.address))) {
    throw new BlockedAddressError("That address is not reachable from the public internet.");
  }

  return { url, address: resolved[0].address, family: resolved[0].family };
}

/**
 * Fetches a tenant-supplied URL, pinned to an address we validated.
 *
 * Redirects are never followed: a redirect is the simplest way around a host
 * check, and the caller decides what to do with a 3xx.
 */
export async function safeFetch(
  rawUrl: string,
  init: Omit<UndiciRequestInit, "dispatcher" | "redirect" | "signal"> & { timeoutMs?: number } = {}
): Promise<UndiciResponse> {
  const target = await approveUrl(rawUrl);
  const { timeoutMs = 10_000, ...rest } = init;

  // Hand the socket the address we approved, while SNI and the Host header
  // keep the original hostname so TLS still validates.
  const agent = new Agent({
    connect: {
      // Node's dns.lookup contract, which undici follows: the callback shape
      // depends on `all`. Both are handled so a change in undici's calling
      // convention cannot silently fall back to an unpinned lookup.
      lookup: (_hostname, options, callback) => {
        if (options?.all) {
          callback(null, [{ address: target.address, family: target.family }]);
        } else {
          (callback as unknown as (
            err: Error | null, address: string, family: number
          ) => void)(null, target.address, target.family);
        }
      },
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // undici's own fetch, not the global one: a dispatcher is only accepted by
    // the undici the request is issued from, and Node's built-in copy rejects
    // an Agent constructed from the userland package.
    return await undiciFetch(target.url, {
      ...rest,
      redirect: "manual",
      signal: controller.signal,
      dispatcher: agent,
    });
  } finally {
    clearTimeout(timer);
    void agent.close().catch(() => undefined);
  }
}
