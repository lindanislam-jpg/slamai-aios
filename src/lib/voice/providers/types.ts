/**
 * The telephony provider contract.
 *
 * SlamAI Voice never talks to Twilio (or any carrier) directly outside an
 * adapter. Everything the platform needs from a carrier is listed here, so a
 * second provider is a new file rather than a refactor.
 *
 * Real-time media (barge-in, sub-second latency) is provider specific; the
 * `speechTurn` shape below is what a turn-based adapter returns, and a
 * streaming adapter can implement the same interface by resolving turns from
 * its own socket.
 */

export type ProviderNumber = {
  /** E.164, e.g. "+353871234567". */
  e164: string;
  providerSid: string;
  friendlyName?: string;
  capabilities: { voice: boolean; sms: boolean };
  /** Monthly cost in the provider's currency, when known. */
  monthlyCost?: number;
};

export type NumberSearchCriteria = {
  country: string;
  areaCode?: string;
  contains?: string;
  limit?: number;
};

export type CallRecording = {
  url: string;
  durationSec: number;
};

export type ProviderCall = {
  providerCallId: string;
  from: string;
  to: string;
  status: string;
  durationSec: number;
};

export interface VoiceProvider {
  readonly name: string;
  /** Whether credentials are present. */
  isConfigured(): boolean;

  /** Numbers available to buy. */
  searchAvailableNumbers(criteria: NumberSearchCriteria): Promise<ProviderNumber[]>;
  /** Buys a number and points it at this platform. */
  purchaseNumber(e164: string, webhookBaseUrl: string): Promise<ProviderNumber>;
  /** Repoints an already-owned number at this platform. */
  configureNumber(providerSid: string, webhookBaseUrl: string): Promise<void>;
  /** Gives the number up. */
  releaseNumber(providerSid: string): Promise<void>;
  /** Numbers already on the account, for connecting an existing number. */
  listOwnedNumbers(): Promise<ProviderNumber[]>;

  getCall(providerCallId: string): Promise<ProviderCall | null>;
  getRecording(providerCallId: string): Promise<CallRecording | null>;
  /** Ends a call in progress. */
  endCall(providerCallId: string): Promise<void>;

  /**
   * Verifies an inbound webhook and returns its parsed body, or null when the
   * request cannot be trusted. Callers must treat null as "reject".
   */
  verifyWebhook(req: Request): Promise<Record<string, string> | null>;
}

export class VoiceProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `The ${provider} voice provider is not configured. Add its credentials in Settings → Phone to buy or connect numbers.`
    );
    this.name = "VoiceProviderNotConfiguredError";
  }
}
