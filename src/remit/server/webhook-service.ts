import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "./audit";
import type { WebhookEnvelope } from "../providers/types";

/**
 * Webhook processing.
 *
 * Two guarantees, both structural rather than best-effort:
 *
 *  1. SIGNATURE. The envelope only exists if the provider's adapter verified
 *     the signature. An unverified body never reaches this module.
 *
 *  2. IDEMPOTENCY. The event is inserted first, behind a unique index on
 *     (provider, externalId). A duplicate delivery loses the insert and is
 *     skipped — so a provider retry cannot pay a recipient twice.
 */

export interface WebhookOutcome {
  processed: boolean;
  duplicate: boolean;
  error?: string;
}

export async function processWebhook(
  envelope: WebhookEnvelope,
  handler: (envelope: WebhookEnvelope) => Promise<void>,
): Promise<WebhookOutcome> {
  let eventId: string;
  try {
    const event = await db.remitProviderEvent.create({
      data: {
        provider: envelope.provider,
        externalId: envelope.externalId,
        eventType: envelope.eventType,
        signatureVerified: true,
        payload: envelope.payload as object,
      },
    });
    eventId = event.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      // Already seen. Acknowledge so the provider stops retrying.
      return { processed: false, duplicate: true };
    }
    throw error;
  }

  try {
    await handler(envelope);
    await db.remitProviderEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
    await recordAudit({
      actorType: "PROVIDER",
      actorId: envelope.provider,
      action: `webhook.${envelope.eventType}`,
      entityType: "RemitProviderEvent",
      entityId: eventId,
    });
    return { processed: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    // The event row stays with processedAt null and the error recorded, so a
    // failed webhook is visible and replayable rather than lost.
    await db.remitProviderEvent.update({
      where: { id: eventId },
      data: { error: message },
    });
    console.error(`[remit:webhook] ${envelope.provider}/${envelope.eventType} failed:`, message);
    return { processed: false, duplicate: false, error: message };
  }
}

/** Look a transfer up by the reference we gave the provider. */
export async function findTransferByReference(reference: string) {
  return db.remitTransfer.findUnique({ where: { reference } });
}

export function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}
