import { db } from "@/lib/db";
import { getVoiceProvider, appBaseUrl } from "@/lib/voice/providers";
import { twiml, sayAndGather, hangup, say, escapeXml } from "@/lib/voice/twiml";
import { isOpenAt, DEFAULT_HOURS, type HourRow } from "@/lib/voice/hours";
import { isOverMinutes } from "@/lib/voice/usage";
import { dispatchEvent } from "@/lib/voice/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * An inbound call has arrived.
 *
 * The dialled number (`To`) is the tenant boundary: `PhoneNumber.e164` is
 * globally unique, so it resolves to exactly one business. Nothing about the
 * caller is trusted to choose a tenant.
 */
export async function POST(req: Request) {
  const provider = getVoiceProvider();
  const params = await provider.verifyWebhook(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const providerCallId = params.CallSid;
  const from = params.From || "Unknown";
  const to = params.To || "";

  const number = await db.phoneNumber.findUnique({
    where: { e164: to },
    include: {
      business: {
        select: { id: true, status: true, timezone: true, businessHours: true, subscription: true },
      },
      agent: true,
    },
  });

  const fallbackVoice = { voice: "Polly.Amy-Neural", language: "en-GB" };

  if (!number || !number.business) {
    return twiml(
      hangup("Thanks for calling. This number isn't connected to a service right now. Goodbye.", fallbackVoice)
    );
  }

  const agent =
    number.agent ??
    (await db.receptionAgent.findFirst({
      where: { businessId: number.businessId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }));

  const speech = agent
    ? { voice: agent.voice, language: agent.language }
    : fallbackVoice;

  if (number.business.status !== "active") {
    return twiml(
      hangup("Thanks for calling. This service is temporarily unavailable. Please try again later.", speech)
    );
  }

  if (!agent || !agent.isActive) {
    // Forward to a human rather than dropping the caller, if we can.
    if (number.forwardTo) {
      return twiml(
        say("One moment please.", speech) + `<Dial>${escapeXml(number.forwardTo)}</Dial>`
      );
    }
    return twiml(
      hangup("Thanks for calling. Our assistant isn't available right now. Please try again later.", speech)
    );
  }

  // A tenant out of minutes is not cut off mid-relationship: the call is
  // still answered by a person if one is configured, and the owner is told.
  const subscription = number.business.subscription;
  if (await isOverMinutes(number.businessId, subscription?.planId ?? "trial", subscription?.minutesOverride)) {
    const forward = number.forwardTo || agent.transferNumber || agent.fallbackNumber;
    if (forward) {
      return twiml(say("One moment please.", speech) + `<Dial>${escapeXml(forward)}</Dial>`);
    }
    return twiml(
      hangup(
        "Thanks for calling. We can't take your call automatically right now. Please try again shortly.",
        speech
      )
    );
  }

  const hours: HourRow[] =
    number.business.businessHours.length === 7
      ? number.business.businessHours.map((h) => ({
          weekday: h.weekday, isOpen: h.isOpen, opensAt: h.opensAt, closesAt: h.closesAt,
        }))
      : DEFAULT_HOURS;
  const afterHours = !isOpenAt(hours, number.business.timezone);

  // Voicemail-only after hours: take the message and stop paying for AI turns.
  const voicemail = afterHours && agent.afterHoursMode === "voicemail";

  // Upsert keeps a retried webhook from creating a second call record. This
  // happens before the voicemail branch returns, because the recording and
  // status callbacks both look the call up by provider id and drop the event
  // when there is nothing to attach it to.
  const call = await db.voiceCall.upsert({
    where: { providerCallId },
    update: { status: "in_progress" },
    create: {
      businessId: number.businessId,
      agentId: agent.id,
      phoneNumberId: number.id,
      providerCallId,
      provider: provider.name,
      fromNumber: from,
      toNumber: to,
      direction: "inbound",
      status: "in_progress",
      afterHours,
      // Voicemail is the caller talking to a tape, not to the AI. The outcome
      // is left to the recording callback, so a caller who hangs up without
      // leaving anything is not recorded as having left a message.
      ...(voicemail && { aiHandled: false }),
      turns: { create: { role: "agent", text: agent.greeting, offsetSec: 0 } },
    },
  });

  void dispatchEvent(number.businessId, "call.started", {
    callId: call.id,
    from,
    to,
    afterHours,
  });

  if (voicemail) {
    return twiml(
      say(
        `${agent.greeting} We're closed at the moment. Please leave your name, number and message after the tone, and we'll call you back.`,
        speech
      ) +
        `<Record maxLength="120" playBeep="true" transcribe="false" ` +
        `recordingStatusCallback="${escapeXml(`${appBaseUrl()}/api/webhooks/twilio/recording`)}" />` +
        say("Thank you. Goodbye.", speech) +
        `<Hangup/>`
    );
  }

  return twiml(
    sayAndGather(agent.greeting, speech, `${appBaseUrl()}/api/webhooks/twilio/respond?callId=${call.id}`)
  );
}
