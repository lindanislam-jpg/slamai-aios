import { ProviderNotConfiguredError, type NotificationProvider, type ProviderInfo, type SendNotificationRequest, type SendNotificationResult } from "../types";

/**
 * Resend email adapter.
 *
 * Calls the Resend REST API directly rather than pulling in an SDK — it is one
 * POST, and a dependency for that is not worth the supply-chain surface in a
 * payments codebase.
 *
 * Activates only when `RESEND_API_KEY` is set; otherwise the registry falls
 * back to the sandbox provider and the health endpoint says email is not
 * connected. The key is read from the environment and never logged.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  reply_to?: string;
}

/**
 * Build the request body. Pure, so the shape can be asserted in a test without
 * making a network call or holding a real API key.
 */
export function buildResendPayload(
  request: SendNotificationRequest,
  from: string,
  replyTo?: string,
): ResendPayload {
  if (request.channel !== "EMAIL") {
    throw new Error(`Resend only sends email, not ${request.channel}`);
  }
  return {
    from,
    to: [request.destination],
    subject: request.subject ?? "",
    text: request.body,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
}

export class ResendNotificationProvider implements NotificationProvider {
  readonly info: ProviderInfo;
  readonly supportedChannels: NotificationProvider["supportedChannels"] = ["EMAIL"];

  private readonly apiKey: string;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(apiKey: string, from: string, replyTo?: string) {
    if (!apiKey) throw new ProviderNotConfiguredError("Notification", "resend");
    if (!from) {
      throw new ProviderNotConfiguredError(
        "Notification",
        "resend (REMIT_EMAIL_FROM is required, e.g. \"Kora Send <no-reply@yourdomain.com>\")",
      );
    }
    this.apiKey = apiKey;
    this.from = from;
    this.replyTo = replyTo;
    this.info = {
      key: "resend",
      displayName: "Resend",
      isLive: true,
      statusLabel: "Live",
    };
  }

  async send(request: SendNotificationRequest): Promise<SendNotificationResult> {
    const payload = buildResendPayload(request, this.from, this.replyTo);

    // A hanging email provider must not hold a transfer's request open.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Resend returns a JSON error body; keep the message but never echo
        // the request, which contains the recipient's address and, for a
        // verification email, their code.
        const detail = await safeErrorMessage(response);
        return { delivered: false, error: `Resend responded ${response.status}: ${detail}` };
      }

      const body = (await response.json()) as { id?: string };
      return { delivered: true, providerRef: body.id };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Resend did not respond within ${TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : "Resend request failed";
      return { delivered: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; name?: string };
    return body.message ?? body.name ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
