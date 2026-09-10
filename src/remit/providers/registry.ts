import { settings } from "../config/settings";
import {
  SandboxFxProvider,
  SandboxKycProvider,
  SandboxNotificationProvider,
  SandboxPaymentProvider,
  SandboxPayoutProvider,
  SandboxScreeningProvider,
} from "./sandbox";
import { StripePaymentProvider } from "./stripe/payment";
import { ResendNotificationProvider } from "./resend/notification";
import {
  ProviderNotConfiguredError,
  type FXProvider,
  type KYCProvider,
  type NotificationProvider,
  type PaymentProvider,
  type PayoutProvider,
  type ScreeningProvider,
} from "./types";

/**
 * Provider registry.
 *
 * Nothing in the application imports a provider directly. Swapping Stripe for
 * another payment institution, or the sandbox payout partner for a licensed
 * one, is a change to this file and an environment variable — not a change to
 * the transfer engine.
 */

const paymentProviders = new Map<string, () => PaymentProvider>([
  ["sandbox", () => new SandboxPaymentProvider()],
  [
    "stripe",
    () => {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new ProviderNotConfiguredError("Payment", "stripe");
      return new StripePaymentProvider(key);
    },
  ],
]);

const payoutProviders = new Map<string, () => PayoutProvider>([
  ["sandbox", () => new SandboxPayoutProvider()],
]);

const fxProviders = new Map<string, () => FXProvider>([["sandbox", () => new SandboxFxProvider()]]);

const kycProviders = new Map<string, () => KYCProvider>([
  ["sandbox", () => new SandboxKycProvider()],
]);

const screeningProviders = new Map<string, () => ScreeningProvider>([
  ["sandbox", () => new SandboxScreeningProvider()],
]);

const notificationProviders = new Map<string, () => NotificationProvider>([
  ["sandbox", () => new SandboxNotificationProvider()],
  [
    "resend",
    () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new ProviderNotConfiguredError("Notification", "resend");
      return new ResendNotificationProvider(
        key,
        process.env.REMIT_EMAIL_FROM ?? "",
        process.env.REMIT_EMAIL_REPLY_TO || undefined,
      );
    },
  ],
]);

function resolve<T>(
  registry: Map<string, () => T>,
  key: string,
  kind: string,
  cache: Map<string, T>,
): T {
  const cached = cache.get(key);
  if (cached) return cached;
  const factory = registry.get(key);
  if (!factory) throw new ProviderNotConfiguredError(kind, key);
  const instance = factory();
  cache.set(key, instance);
  return instance;
}

const caches = {
  payment: new Map<string, PaymentProvider>(),
  payout: new Map<string, PayoutProvider>(),
  fx: new Map<string, FXProvider>(),
  kyc: new Map<string, KYCProvider>(),
  screening: new Map<string, ScreeningProvider>(),
  notification: new Map<string, NotificationProvider>(),
};

export function getPaymentProvider(key = settings.providers.payment): PaymentProvider {
  return resolve(paymentProviders, key, "Payment", caches.payment);
}

export function getPayoutProvider(key = settings.providers.payout): PayoutProvider {
  return resolve(payoutProviders, key, "Payout", caches.payout);
}

export function getFxProvider(key = settings.providers.fx): FXProvider {
  return resolve(fxProviders, key, "FX", caches.fx);
}

export function getKycProvider(key = settings.providers.kyc): KYCProvider {
  return resolve(kycProviders, key, "KYC", caches.kyc);
}

export function getScreeningProvider(key = settings.providers.screening): ScreeningProvider {
  return resolve(screeningProviders, key, "Screening", caches.screening);
}

export function getNotificationProvider(key = settings.providers.notification): NotificationProvider {
  return resolve(notificationProviders, key, "Notification", caches.notification);
}

/** Provider status for the admin dashboard. Never exposes credentials. */
export function providerStatuses() {
  const safe = <T extends { info: { key: string; displayName: string; isLive: boolean; statusLabel: string } }>(
    kind: string,
    load: () => T,
    configured: string,
  ) => {
    try {
      const provider = load();
      return { kind, configured, ...provider.info, error: null as string | null };
    } catch (error) {
      return {
        kind,
        configured,
        key: configured,
        displayName: configured,
        isLive: false,
        statusLabel: "Not yet connected",
        error: error instanceof Error ? error.message : "Unavailable",
      };
    }
  };

  return [
    safe("Payment", () => getPaymentProvider(), settings.providers.payment),
    safe("Payout", () => getPayoutProvider(), settings.providers.payout),
    safe("FX", () => getFxProvider(), settings.providers.fx),
    safe("KYC", () => getKycProvider(), settings.providers.kyc),
    safe("Screening", () => getScreeningProvider(), settings.providers.screening),
    safe("Notification", () => getNotificationProvider(), settings.providers.notification),
  ];
}

/** Test seam: drop cached instances so env changes take effect. */
export function resetProviderCaches(): void {
  Object.values(caches).forEach((cache) => cache.clear());
}
