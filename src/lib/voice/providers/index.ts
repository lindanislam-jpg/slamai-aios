import "server-only";
import type { VoiceProvider } from "./types";
import { TwilioVoiceProvider } from "./twilio-provider";

/**
 * Provider selection. `VOICE_PROVIDER` names the adapter; adding a carrier
 * means adding a case here and a file next to this one.
 */
let instance: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (instance) return instance;
  const configured = (process.env.VOICE_PROVIDER || "twilio").toLowerCase();
  switch (configured) {
    case "twilio":
    default:
      instance = new TwilioVoiceProvider();
  }
  return instance;
}

export function isVoiceProviderConfigured(): boolean {
  return getVoiceProvider().isConfigured();
}

/** The base URL Twilio (or any carrier) should call back on. */
export function appBaseUrl(): string {
  return (
    process.env.VOICE_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3005"
  ).replace(/\/$/, "");
}

export * from "./types";
