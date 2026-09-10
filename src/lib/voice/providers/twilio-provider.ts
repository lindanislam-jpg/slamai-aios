import "server-only";
import twilio, { validateRequest, type Twilio } from "twilio";
import type {
  VoiceProvider, ProviderNumber, NumberSearchCriteria, CallRecording, ProviderCall,
} from "./types";
import { VoiceProviderNotConfiguredError } from "./types";

/** Where Twilio should post the events for a number we control. */
export const TWILIO_WEBHOOK_PATHS = {
  incoming: "/api/webhooks/twilio/voice",
  status: "/api/webhooks/twilio/status",
  recording: "/api/webhooks/twilio/recording",
} as const;

export class TwilioVoiceProvider implements VoiceProvider {
  readonly name = "twilio";
  private client: Twilio | null = null;

  isConfigured(): boolean {
    return Boolean(
      (process.env.VOICE_PROVIDER_ACCOUNT_ID || process.env.TWILIO_ACCOUNT_SID) &&
        (process.env.VOICE_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN)
    );
  }

  private get authToken(): string | undefined {
    return process.env.VOICE_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN;
  }

  private get sdk(): Twilio {
    if (!this.isConfigured()) throw new VoiceProviderNotConfiguredError(this.name);
    if (!this.client) {
      this.client = twilio(
        process.env.VOICE_PROVIDER_ACCOUNT_ID || process.env.TWILIO_ACCOUNT_SID,
        this.authToken
      );
    }
    return this.client;
  }

  async searchAvailableNumbers(criteria: NumberSearchCriteria): Promise<ProviderNumber[]> {
    const numbers = await this.sdk
      .availablePhoneNumbers(criteria.country)
      .local.list({
        ...(criteria.areaCode && { areaCode: Number(criteria.areaCode) }),
        ...(criteria.contains && { contains: criteria.contains }),
        limit: criteria.limit ?? 10,
      });

    return numbers.map((n) => ({
      e164: n.phoneNumber,
      providerSid: "",
      friendlyName: n.friendlyName,
      capabilities: { voice: Boolean(n.capabilities?.voice), sms: Boolean(n.capabilities?.sms) },
    }));
  }

  async purchaseNumber(e164: string, webhookBaseUrl: string): Promise<ProviderNumber> {
    const purchased = await this.sdk.incomingPhoneNumbers.create({
      phoneNumber: e164,
      voiceUrl: `${webhookBaseUrl}${TWILIO_WEBHOOK_PATHS.incoming}`,
      voiceMethod: "POST",
      statusCallback: `${webhookBaseUrl}${TWILIO_WEBHOOK_PATHS.status}`,
      statusCallbackMethod: "POST",
    });

    return {
      e164: purchased.phoneNumber,
      providerSid: purchased.sid,
      friendlyName: purchased.friendlyName,
      capabilities: {
        voice: Boolean(purchased.capabilities?.voice),
        sms: Boolean(purchased.capabilities?.sms),
      },
    };
  }

  async configureNumber(providerSid: string, webhookBaseUrl: string): Promise<void> {
    await this.sdk.incomingPhoneNumbers(providerSid).update({
      voiceUrl: `${webhookBaseUrl}${TWILIO_WEBHOOK_PATHS.incoming}`,
      voiceMethod: "POST",
      statusCallback: `${webhookBaseUrl}${TWILIO_WEBHOOK_PATHS.status}`,
      statusCallbackMethod: "POST",
    });
  }

  async releaseNumber(providerSid: string): Promise<void> {
    await this.sdk.incomingPhoneNumbers(providerSid).remove();
  }

  async listOwnedNumbers(): Promise<ProviderNumber[]> {
    const numbers = await this.sdk.incomingPhoneNumbers.list({ limit: 100 });
    return numbers.map((n) => ({
      e164: n.phoneNumber,
      providerSid: n.sid,
      friendlyName: n.friendlyName,
      capabilities: { voice: Boolean(n.capabilities?.voice), sms: Boolean(n.capabilities?.sms) },
    }));
  }

  async getCall(providerCallId: string): Promise<ProviderCall | null> {
    try {
      const call = await this.sdk.calls(providerCallId).fetch();
      return {
        providerCallId: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        durationSec: Number(call.duration || 0),
      };
    } catch {
      return null;
    }
  }

  async getRecording(providerCallId: string): Promise<CallRecording | null> {
    try {
      const recordings = await this.sdk.recordings.list({ callSid: providerCallId, limit: 1 });
      const recording = recordings[0];
      if (!recording) return null;
      return {
        url: `https://api.twilio.com${recording.uri.replace(".json", ".mp3")}`,
        durationSec: Number(recording.duration || 0),
      };
    } catch {
      return null;
    }
  }

  async endCall(providerCallId: string): Promise<void> {
    await this.sdk.calls(providerCallId).update({ status: "completed" });
  }

  /**
   * Twilio signs the full URL plus the sorted POST body with the account's
   * auth token. Webhooks arrive unauthenticated from the public internet, so
   * this must pass before a handler acts on anything in the body.
   */
  async verifyWebhook(req: Request): Promise<Record<string, string> | null> {
    const token = this.authToken;
    if (!token) {
      console.error("[twilio] no auth token — refusing to trust this webhook.");
      return null;
    }

    const signature = req.headers.get("x-twilio-signature");
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    // Local tunnels rewrite the host, so the signed URL cannot be rebuilt.
    // Opting out is development-only and can never apply in production.
    if (process.env.VOICE_SKIP_SIGNATURE_CHECK === "true" && process.env.NODE_ENV !== "production") {
      console.warn("[twilio] signature validation skipped (VOICE_SKIP_SIGNATURE_CHECK).");
      return params;
    }

    if (!signature) return null;

    if (!validateRequest(token, signature, publicWebhookUrl(req), params)) {
      console.error("[twilio] signature validation failed.");
      return null;
    }
    return params;
  }
}

/**
 * The public URL Twilio actually called. Behind a proxy the request's own host
 * is rewritten, and the signature is computed over the exact original URL.
 */
export function publicWebhookUrl(req: Request): string {
  const configured =
    process.env.VOICE_WEBHOOK_BASE_URL ||
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  const url = new URL(req.url);

  if (configured) {
    const base = new URL(configured);
    url.protocol = base.protocol;
    url.host = base.host;
  } else {
    const proto = req.headers.get("x-forwarded-proto");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (proto) url.protocol = `${proto}:`;
    if (host) url.host = host;
  }
  return url.toString();
}
