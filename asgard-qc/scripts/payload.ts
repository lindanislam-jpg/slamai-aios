import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

/** Reads a one-off import payload from build environment variables.
 *  <NAME>_GZ holds base64 of the gzipped JSON; a large payload may be split
 *  across <NAME>_GZ, <NAME>_GZ_2 … <NAME>_GZ_9 (joined in order). <NAME>_SHA256
 *  is the sha256 of the uncompressed JSON: a damaged or partial payload is
 *  refused, so nothing is imported from it. Returns null when not set. */
export function readPayload<T>(name: string): T | null {
  const parts = [process.env[`${name}_GZ`], ...Array.from({ length: 8 }, (_, i) => process.env[`${name}_GZ_${i + 2}`])].map((p) => p?.trim() ?? "");
  const gz = parts.join("");
  if (!gz) return null;
  // Fingerprint of each part (not its content), so a part damaged in transit can be re-sent on its own.
  const prints = parts.map((p, i) => (p ? `part${i + 1}:${p.length}:${createHash("sha256").update(p).digest("hex").slice(0, 12)}` : null)).filter(Boolean).join(" ");
  let raw: string;
  try {
    raw = gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
  } catch {
    throw new Error(`${name} payload is damaged and cannot be unpacked (${prints}). Nothing imported.`);
  }
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env[`${name}_SHA256`]?.trim()) throw new Error(`${name} payload checksum mismatch (got ${sha}; ${prints}). Nothing imported.`);
  return JSON.parse(raw) as T;
}
