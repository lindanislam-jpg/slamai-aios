import "server-only";
import { validateRequest } from "twilio";

/**
 * Twilio webhooks arrive unauthenticated from the public internet, so every
 * handler must prove the request really came from Twilio before acting on it.
 * Twilio signs the full URL plus the sorted POST body with the account's auth
 * token; `validateRequest` recomputes that signature.
 */
export function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_AUTH_TOKEN);
}

/**
 * The public URL Twilio used to reach us. Behind Vercel's proxy the request's
 * own host header is right, but the protocol needs the forwarded header — and
 * the signature is computed over the exact URL Twilio called.
 */
export function webhookUrl(req: Request): string {
  const configured = process.env.TWILIO_WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL;
  const url = new URL(req.url);

  if (configured) {
    const base = new URL(configured);
    url.protocol = base.protocol;
    url.host = base.host;
  } else {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (forwardedProto) url.protocol = `${forwardedProto}:`;
    if (forwardedHost) url.host = forwardedHost;
  }

  return url.toString();
}

/**
 * Verifies the signature and returns the parsed form body, or null if the
 * request can't be trusted. Callers must treat null as "reject".
 */
export async function verifyTwilioRequest(
  req: Request
): Promise<Record<string, string> | null> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error("TWILIO_AUTH_TOKEN is not set — refusing to trust this webhook.");
    return null;
  }

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return null;

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  // Skipping verification is only ever allowed when explicitly opted into, for
  // local testing against a tunnel where the public URL can't be reconstructed.
  if (process.env.TWILIO_SKIP_VALIDATION === "true" && process.env.NODE_ENV !== "production") {
    console.warn("Twilio signature validation skipped (TWILIO_SKIP_VALIDATION).");
    return params;
  }

  const valid = validateRequest(token, signature, webhookUrl(req), params);
  if (!valid) {
    console.error("Twilio signature validation failed.");
    return null;
  }

  return params;
}
