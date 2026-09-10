import "server-only";
import { db } from "@/lib/db";
import { getAIProvider } from "./ai";
import { ANALYSIS_PROMPT } from "./prompt";
import { scoreLead, type LeadSignals } from "./scoring";
import { upsertCustomer, type CapturedDetails } from "./conversation";
import { recordUsage } from "./usage";
import { notify } from "./notifications";
import { dispatchEvent } from "./webhooks";
import { HIGH_VALUE_LEAD_SCORE } from "./events";

/**
 * What happens after the caller hangs up.
 *
 * Everything downstream of a call runs here so it happens identically whether
 * the call ended normally, was transferred, or the provider's status callback
 * arrived late:
 *
 *   transcript → AI analysis → customer → lead + score → usage → notifications
 *
 * The function is idempotent on `callId`: a retried provider webhook re-runs it
 * without creating a second lead, because Lead.callId is unique.
 */

type Analysis = {
  summary: string;
  intent: string;
  urgency: string;
  sentiment: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceRequested: string | null;
  namedService: boolean;
  highValue: boolean;
  readyToProceed: boolean;
  isEmergency: boolean;
  unansweredQuestion: string | null;
};

const EMPTY_ANALYSIS: Analysis = {
  summary: "",
  intent: "unknown",
  urgency: "normal",
  sentiment: "neutral",
  customerName: null,
  customerEmail: null,
  customerPhone: null,
  serviceRequested: null,
  namedService: false,
  highValue: false,
  readyToProceed: false,
  isEmergency: false,
  unansweredQuestion: null,
};

export async function finaliseCall(
  callId: string,
  options: { captured?: CapturedDetails } = {}
): Promise<void> {
  const call = await db.voiceCall.findUnique({
    where: { id: callId },
    include: {
      turns: { orderBy: { offsetSec: "asc" } },
      business: { select: { id: true, name: true, timezone: true } },
    },
  });
  if (!call) return;

  // Already finalised (a duplicate provider callback) — nothing to redo.
  if (call.summary) return;

  const transcript = call.turns
    .map((t) => `${t.role === "caller" ? "CUSTOMER" : "AI"}: ${t.text}`)
    .join("\n");

  const analysis = transcript ? await analyseTranscript(transcript) : EMPTY_ANALYSIS;
  const captured = options.captured ?? {};

  const name = captured.name ?? analysis.customerName ?? null;
  const phone = captured.phone ?? analysis.customerPhone ?? call.fromNumber ?? null;
  const email = captured.email ?? analysis.customerEmail ?? null;
  const service = captured.service ?? analysis.serviceRequested ?? null;
  const urgency = captured.urgent ? "urgent" : analysis.urgency;
  const isEmergency = analysis.isEmergency || urgency === "emergency";

  const customer = await upsertCustomer(call.businessId, {
    name: name ?? undefined,
    phone: phone ?? undefined,
    email: email ?? undefined,
    address: captured.address,
  });

  const booked = await db.appointment.count({ where: { callId, status: { in: ["pending", "confirmed"] } } });

  const signals: LeadSignals = {
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email),
    hasName: Boolean(name),
    namedService: analysis.namedService || Boolean(captured.service),
    booked: booked > 0,
    urgency,
    intent: analysis.intent,
    durationSec: call.durationSec,
    highValue: analysis.highValue,
    readyToProceed: analysis.readyToProceed,
  };
  const scored = scoreLead(signals);

  const outcome = resolveOutcome(call.transferred, booked > 0, Boolean(phone && name), captured, analysis);

  await db.voiceCall.update({
    where: { id: callId },
    data: {
      summary: analysis.summary || fallbackSummary(call.turns.length),
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      isEmergency,
      outcome,
      customerId: customer?.id ?? call.customerId,
      status: call.status === "in_progress" ? "completed" : call.status,
      endedAt: call.endedAt ?? new Date(),
    },
  });

  // Worth recording as a lead only when there is something to follow up on.
  const worthCapturing =
    analysis.intent !== "spam" && (Boolean(phone) || Boolean(email)) && call.turns.length > 1;

  let leadId: string | null = null;
  if (worthCapturing) {
    const lead = await db.lead
      .upsert({
        where: { callId },
        update: {},
        create: {
          businessId: call.businessId,
          customerId: customer?.id ?? null,
          callId,
          name,
          phone,
          email,
          serviceRequested: service,
          summary: analysis.summary || captured.message || null,
          score: scored.score,
          status: booked > 0 ? "booked" : "new",
          source: "voice_call",
          urgency,
          notes: captured.message ?? null,
        },
      })
      .catch((err) => {
        console.error("[call-flow] lead upsert failed", err);
        return null;
      });
    leadId = lead?.id ?? null;
  }

  const minutes = Math.max(1, Math.ceil(call.durationSec / 60));
  await recordUsage(call.businessId, "voice_minutes", minutes, callId);
  await recordUsage(call.businessId, "calls", 1, callId);
  if (call.transferred) await recordUsage(call.businessId, "transfers", 1, callId);

  await fireEvents({
    businessId: call.businessId,
    businessName: call.business.name,
    callId,
    leadId,
    score: scored.score,
    name,
    phone,
    summary: analysis.summary,
    isEmergency,
    transferred: call.transferred,
    booked: booked > 0,
    unanswered: analysis.unansweredQuestion,
    tookMessage: outcome === "message_taken",
  });
}

async function analyseTranscript(transcript: string): Promise<Analysis> {
  const ai = getAIProvider();
  if (!ai.isConfigured()) return EMPTY_ANALYSIS;

  try {
    const result = await ai.chat({
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: transcript.slice(0, 12_000) },
      ],
      json: true,
      temperature: 0.1,
      maxTokens: 500,
    });
    const parsed = JSON.parse(result.text) as Partial<Analysis>;
    return { ...EMPTY_ANALYSIS, ...parsed };
  } catch (err) {
    console.error("[call-flow] analysis failed", err);
    return EMPTY_ANALYSIS;
  }
}

function fallbackSummary(turnCount: number): string {
  return turnCount > 1
    ? "The call was answered but could not be summarised automatically. The transcript is available."
    : "The caller hung up before saying anything.";
}

function resolveOutcome(
  transferred: boolean,
  booked: boolean,
  capturedLead: boolean,
  captured: CapturedDetails,
  analysis: Analysis
): string {
  if (transferred) return "transferred";
  if (booked) return "booked";
  if (captured.message && !capturedLead) return "message_taken";
  if (capturedLead) return "lead_captured";
  if (analysis.intent === "support" || analysis.intent === "enquiry") return "info_only";
  return "answered";
}

async function fireEvents(input: {
  businessId: string;
  businessName: string;
  callId: string;
  leadId: string | null;
  score: number;
  name: string | null;
  phone: string | null;
  summary: string;
  isEmergency: boolean;
  transferred: boolean;
  booked: boolean;
  unanswered: string | null;
  tookMessage: boolean;
}) {
  const who = input.name ?? input.phone ?? "A caller";
  const link = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/app/calls/${input.callId}`;

  void dispatchEvent(input.businessId, "call.ended", {
    callId: input.callId,
    summary: input.summary,
    leadScore: input.score,
    transferred: input.transferred,
    booked: input.booked,
  });
  void dispatchEvent(input.businessId, "transcript.completed", { callId: input.callId });

  if (input.isEmergency) {
    await notify({
      businessId: input.businessId,
      event: "call.emergency",
      title: `Urgent call — ${who}`,
      body: `${input.summary}\n${input.phone ?? ""}\n${link}`,
      data: { callId: input.callId, phone: input.phone },
    });
  }

  if (input.transferred) {
    await notify({
      businessId: input.businessId,
      event: "call.transferred",
      title: `Call transferred — ${who}`,
      body: `${input.summary}\n${link}`,
      data: { callId: input.callId },
    });
  }

  if (input.leadId) {
    await notify({
      businessId: input.businessId,
      event: "lead.created",
      title: `New lead — ${who} (${input.score}/100)`,
      body: `${input.summary}\n${input.phone ?? ""}\n${link}`,
      data: { callId: input.callId, leadId: input.leadId, score: input.score },
    });

    if (input.score >= HIGH_VALUE_LEAD_SCORE) {
      await notify({
        businessId: input.businessId,
        event: "lead.high_value",
        title: `High-value lead — ${who} (${input.score}/100)`,
        body: `${input.summary}\n${input.phone ?? ""}\n${link}`,
        data: { callId: input.callId, leadId: input.leadId, score: input.score },
      });
    }
  }

  if (input.booked) {
    void dispatchEvent(input.businessId, "appointment.booked", { callId: input.callId });
    await notify({
      businessId: input.businessId,
      event: "appointment.booked",
      title: `Appointment booked — ${who}`,
      body: `${input.summary}\n${link}`,
      data: { callId: input.callId },
    });
  }

  if (input.tookMessage) {
    await notify({
      businessId: input.businessId,
      event: "message.taken",
      title: `Message taken — ${who}`,
      body: `${input.summary}\n${input.phone ?? ""}\n${link}`,
      data: { callId: input.callId },
    });
  }

  if (input.unanswered) {
    await notify({
      businessId: input.businessId,
      event: "agent.unanswered",
      title: "Your AI couldn't answer a question",
      body: `"${input.unanswered}"\nAdd this to your knowledge base so it can answer next time.\n${link}`,
      data: { callId: input.callId, question: input.unanswered },
    });
  }
}
