import "server-only";
import { db } from "@/lib/db";
import type { EventKey } from "./events";
import {
  signPayload, SIGNATURE_HEADER, TIMESTAMP_HEADER,
} from "./signing";

/**
 * Outbound webhook delivery — the integration surface for n8n, Zapier and
 * CRMs. The signing primitives live in ./signing.ts; this module handles
 * fan-out, retries and recording failures.
 */

export {
  generateSecret, signPayload, verifySignature,
  SIGNATURE_HEADER, TIMESTAMP_HEADER,
} from "./signing";

export type WebhookPayload = {
  event: EventKey;
  businessId: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

/**
 * Fires an event to every subscribed endpoint. Failures are recorded on the
 * endpoint and never thrown — a broken n8n instance must not fail a phone call.
 */
export async function dispatchEvent(
  businessId: string,
  event: EventKey,
  data: Record<string, unknown>
): Promise<void> {
  let endpoints;
  try {
    endpoints = await db.webhookEndpoint.findMany({
      where: { businessId, isActive: true },
    });
  } catch (err) {
    console.error("[webhooks] could not load endpoints", err);
    return;
  }

  const subscribed = endpoints.filter((e) => {
    try {
      const events = JSON.parse(e.events) as unknown;
      return Array.isArray(events) && (events.length === 0 || events.includes(event));
    } catch {
      return false;
    }
  });
  if (subscribed.length === 0) return;

  const payload: WebhookPayload = {
    event,
    businessId,
    occurredAt: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);

  await Promise.all(
    subscribed.map(async (endpoint) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [TIMESTAMP_HEADER]: String(timestamp),
            [SIGNATURE_HEADER]: signPayload(endpoint.secret, timestamp, body),
            "X-SlamAI-Event": event,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        await db.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            lastStatus: response.status,
            lastFiredAt: new Date(),
            failureCount: response.ok ? 0 : { increment: 1 },
            // Park an endpoint that has failed repeatedly rather than
            // retrying forever against a dead URL.
            ...(!response.ok && endpoint.failureCount >= 19 && { isActive: false }),
          },
        });
      } catch (err) {
        console.error("[webhooks] delivery failed", endpoint.url, err);
        await db.webhookEndpoint
          .update({
            where: { id: endpoint.id },
            data: {
              lastStatus: 0,
              lastFiredAt: new Date(),
              failureCount: { increment: 1 },
              ...(endpoint.failureCount >= 19 && { isActive: false }),
            },
          })
          .catch(() => undefined);
      }
    })
  );
}
