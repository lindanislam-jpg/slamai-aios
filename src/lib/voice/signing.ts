import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Webhook signing.
 *
 * Kept apart from webhooks.ts (which is server-only and talks to the database)
 * so these pure functions can be unit tested and shipped as a reference
 * implementation for receivers.
 *
 * Each delivery carries:
 *   X-SlamAI-Timestamp: <unix seconds>
 *   X-SlamAI-Signature: sha256=<hex hmac of "<timestamp>.<body>">
 *
 * A receiver must reject anything older than five minutes to stop replays.
 */

export const SIGNATURE_HEADER = "x-slamai-signature";
export const TIMESTAMP_HEADER = "x-slamai-timestamp";
export const MAX_SKEW_SECONDS = 300;

export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function signPayload(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifySignature(
  secret: string,
  signature: string,
  timestamp: number,
  body: string
): boolean {
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_SKEW_SECONDS) return false;

  const expected = Buffer.from(signPayload(secret, timestamp, body));
  const received = Buffer.from(signature);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  return expected.length === received.length && timingSafeEqual(expected, received);
}
