import "server-only";
import { db } from "@/lib/db";
import type { EventKey } from "./events";
import { EVENT_LABELS } from "./events";
import { dispatchEvent } from "./webhooks";
import { safeFetch } from "./egress";

/**
 * Fan-out for a platform event: outbound webhooks always, plus whatever
 * email/SMS rules the tenant configured.
 *
 * Email and SMS transports are pluggable and only *send* when their provider
 * credentials are present. Without them the attempt is recorded as "skipped"
 * so the dashboard can tell the owner exactly what is missing — it is never
 * silently reported as delivered.
 */

export type NotifyInput = {
  businessId: string;
  event: EventKey;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
}

export function isSmsConfigured(): boolean {
  return Boolean(
    (process.env.VOICE_PROVIDER_ACCOUNT_ID || process.env.TWILIO_ACCOUNT_SID) &&
      process.env.NOTIFICATION_SMS_FROM
  );
}

export async function notify(input: NotifyInput): Promise<void> {
  // Webhooks first — they are the integration path and must not wait on email.
  void dispatchEvent(input.businessId, input.event, {
    title: input.title,
    body: input.body,
    ...input.data,
  });

  let rules;
  try {
    rules = await db.notificationRule.findMany({
      where: { businessId: input.businessId, event: input.event, isActive: true },
    });
  } catch (err) {
    console.error("[notifications] could not load rules", err);
    return;
  }

  for (const rule of rules) {
    const log = {
      businessId: input.businessId,
      event: input.event,
      channel: rule.channel,
      target: rule.target,
      payload: JSON.stringify({ title: input.title, body: input.body }),
    };

    try {
      if (rule.channel === "email") {
        if (!isEmailConfigured()) {
          await record({ ...log, status: "skipped", error: "No email provider configured (set RESEND_API_KEY)." });
          continue;
        }
        await sendEmail(rule.target, input.title, input.body);
        await record({ ...log, status: "sent" });
      } else if (rule.channel === "sms") {
        if (!isSmsConfigured()) {
          await record({ ...log, status: "skipped", error: "No SMS sender configured (set NOTIFICATION_SMS_FROM)." });
          continue;
        }
        await sendSms(rule.target, `${input.title}\n${input.body}`);
        await record({ ...log, status: "sent" });
      } else if (rule.channel === "webhook") {
        // Ad-hoc URL rules post the same envelope as a registered endpoint,
        // unsigned — registered endpoints in Settings → Integrations are the
        // signed path and the one to use for anything that matters.
        //
        // The URL came from a tenant, so it goes through safeFetch: the
        // address is resolved and judged at dispatch time, not just when the
        // rule was saved, because a name can be repointed afterwards.
        await safeFetch(rule.target, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-SlamAI-Event": input.event },
          body: JSON.stringify({ event: input.event, ...input.data, title: input.title, body: input.body }),
        });
        await record({ ...log, status: "sent" });
      }
    } catch (err) {
      await record({
        ...log,
        status: "failed",
        error: err instanceof Error ? err.message.slice(0, 250) : "Delivery failed",
      });
    }
  }
}

async function record(data: {
  businessId: string; event: string; channel: string; target: string;
  status: string; error?: string; payload?: string;
}) {
  await db.notificationLog.create({ data }).catch((err) => {
    console.error("[notifications] could not write log", err);
  });
}

/** Resend is the supported transport; SMTP is left as an explicit no-op. */
async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email provider configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_EMAIL_FROM || "SlamAI Voice <notifications@slamai.io>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
}

async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.VOICE_PROVIDER_ACCOUNT_ID || process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.VOICE_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.NOTIFICATION_SMS_FROM;
  if (!sid || !token || !from) throw new Error("No SMS sender configured");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }),
    }
  );

  if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
}

/** Human-readable event name, for the notification settings UI. */
export function eventLabel(event: EventKey): string {
  return EVENT_LABELS[event] ?? event;
}
