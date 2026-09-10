import "server-only";
import { db } from "@/lib/db";
import { getAIProvider, type ChatMessage, type ToolDefinition } from "./ai";
import { buildSystemPrompt } from "./prompt";
import { search, type RetrievedChunk } from "./retrieval";
import { isOpenAt, DEFAULT_HOURS, type HourRow } from "./hours";
import { findSlots, isSlotFree, localToUtc, describeSlot } from "./availability";
import { recordUsage } from "./usage";

/**
 * The conversation engine.
 *
 * One function, `runTurn`, takes everything said so far plus what the caller
 * just said, and returns what the agent should say next and what it decided to
 * do. Both the live Twilio webhook and the in-dashboard test console call it,
 * so what an owner hears when testing is what a real caller gets.
 *
 * Tool calls are executed here rather than by the caller, because booking an
 * appointment and capturing a lead must be transactional with the turn.
 */

export type Turn = { role: "caller" | "agent"; text: string };

export type TurnAction =
  | { type: "speak" }
  | { type: "transfer"; number: string | null; reason: string }
  | { type: "hangup"; reason: string };

export type TurnResult = {
  reply: string;
  action: TurnAction;
  /** Everything the engine did this turn — surfaced in the test console. */
  toolsUsed: { name: string; arguments: Record<string, unknown>; result: string }[];
  knowledgeUsed: { id: string; title: string; score: number }[];
  tokens: number;
  /** Set when an appointment was actually written. */
  appointmentId?: string;
  /** Collected details, merged into the lead when the call ends. */
  captured: CapturedDetails;
};

export type CapturedDetails = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  service?: string;
  message?: string;
  urgent?: boolean;
};

/** Everything the engine needs about a tenant, loaded once per turn. */
export type CallContext = Awaited<ReturnType<typeof loadCallContext>>;

export async function loadCallContext(businessId: string, agentId?: string | null) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      services: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 50 },
      businessHours: true,
    },
  });
  if (!business) throw new Error("Business not found");

  const agent = agentId
    ? await db.receptionAgent.findFirst({ where: { id: agentId, businessId } })
    : await db.receptionAgent.findFirst({
        where: { businessId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
  if (!agent) throw new Error("No AI receptionist is set up for this business");

  const hours: HourRow[] =
    business.businessHours.length === 7
      ? business.businessHours.map((h) => ({
          weekday: h.weekday, isOpen: h.isOpen, opensAt: h.opensAt, closesAt: h.closesAt,
        }))
      : DEFAULT_HOURS;

  return { business, agent, hours };
}

function toolDefinitions(ctx: CallContext, allowTransfer: boolean): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (ctx.agent.leadCaptureEnabled) {
    tools.push({
      name: "capture_lead",
      description:
        "Save the caller's contact details and what they need. Call this as soon as you have their name and a phone number — do not wait until the end of the call.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The caller's name" },
          phone: { type: "string", description: "A phone number to reach them on" },
          email: { type: "string", description: "Their email, if given" },
          address: { type: "string", description: "The job address, if relevant" },
          service: { type: "string", description: "The service they asked about" },
          notes: { type: "string", description: "What they need, in one or two sentences" },
          urgent: { type: "boolean", description: "True if this needs attention today" },
        },
        required: ["notes"],
      },
    });
  }

  if (ctx.agent.bookingEnabled) {
    tools.push({
      name: "check_availability",
      description:
        "Find real appointment times before offering any to the caller. Never suggest a time you have not checked.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string", description: "The service being booked" },
          preferredDate: {
            type: "string",
            description: "The day the caller wants, as YYYY-MM-DD. Omit for the soonest available.",
          },
        },
      },
    });
    tools.push({
      name: "book_appointment",
      description:
        "Book an appointment at a time returned by check_availability, after reading it back to the caller and getting their agreement.",
      parameters: {
        type: "object",
        properties: {
          startsAt: {
            type: "string",
            description: "Local start time in the business's timezone, as YYYY-MM-DDTHH:mm",
          },
          service: { type: "string", description: "The service being booked" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          notes: { type: "string" },
        },
        required: ["startsAt", "customerName"],
      },
    });
  }

  if (allowTransfer) {
    tools.push({
      name: "transfer_call",
      description: "Hand the call to a person. Tell the caller you are putting them through first.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the call is being transferred" },
        },
        required: ["reason"],
      },
    });
  }

  tools.push({
    name: "take_message",
    description: "Record a message for the business when the caller just wants to leave one.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        message: { type: "string" },
      },
      required: ["message"],
    },
  });

  tools.push({
    name: "end_call",
    description: "End the call once the caller has what they need and has said goodbye.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
  });

  return tools;
}

export type RunTurnInput = {
  ctx: CallContext;
  history: Turn[];
  callerSaid: string;
  /** Persist appointments and leads. False for the test console. */
  persist: boolean;
  /** The live call, when there is one. */
  callId?: string;
  callerPhone?: string;
  /** Overrides the real clock, so an owner can test after-hours behaviour. */
  forceAfterHours?: boolean;
};

export async function runTurn(input: RunTurnInput): Promise<TurnResult> {
  const { ctx, history, callerSaid } = input;
  const ai = getAIProvider();

  const captured: CapturedDetails = {};
  const toolsUsed: TurnResult["toolsUsed"] = [];
  let knowledge: RetrievedChunk[] = [];
  let action: TurnAction = { type: "speak" };
  let appointmentId: string | undefined;
  let tokens = 0;

  if (!ai.isConfigured()) {
    return {
      reply:
        "I'm sorry, I can't take this call properly right now. Someone from the team will call you back shortly.",
      action: { type: "hangup", reason: "ai_unavailable" },
      toolsUsed: [],
      knowledgeUsed: [],
      tokens: 0,
      captured,
    };
  }

  // Pull business facts relevant to what was just asked, so the agent quotes
  // rather than guesses.
  try {
    knowledge = await search(ctx.business.id, callerSaid, 4);
  } catch (err) {
    console.error("[conversation] knowledge search failed", err);
  }

  const isOpen = input.forceAfterHours ? false : isOpenAt(ctx.hours, ctx.business.timezone);

  const knownCaller = input.callerPhone
    ? await db.customer.findFirst({
        where: { businessId: ctx.business.id, phone: input.callerPhone },
        select: { name: true, phone: true },
      })
    : null;

  const allowTransfer = Boolean(
    ctx.agent.transferEnabled && (ctx.agent.transferNumber || ctx.agent.fallbackNumber)
  );

  const systemPrompt = buildSystemPrompt({
    business: ctx.business,
    agent: ctx.agent,
    services: ctx.business.services,
    hours: ctx.hours,
    isOpen,
    afterHoursMode: ctx.agent.afterHoursMode,
    knowledge,
    knownCaller,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((t) => ({
      role: t.role === "caller" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    })),
    { role: "user", content: callerSaid },
  ];

  const tools = toolDefinitions(ctx, allowTransfer);

  // At most two rounds: one to call tools, one to speak with the results.
  // A phone caller cannot wait for more, and it bounds the cost per turn.
  let reply = "";

  for (let round = 0; round < 2; round++) {
    const result = await ai.chat({ messages, tools, maxTokens: 220, temperature: 0.6 });
    tokens += result.tokens;

    if (result.toolCalls.length === 0) {
      reply = result.text;
      break;
    }

    messages.push({ role: "assistant", content: result.text || "", toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const outcome = await executeTool(call.name, call.arguments, input, ctx, captured);
      toolsUsed.push({ name: call.name, arguments: call.arguments, result: outcome.message });

      if (outcome.action) action = outcome.action;
      if (outcome.appointmentId) appointmentId = outcome.appointmentId;

      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: outcome.message,
      });
    }

    if (result.text) reply = result.text;

    // A transfer or hangup ends the turn — nothing after it gets spoken.
    if (action.type !== "speak") {
      if (!reply) {
        reply =
          action.type === "transfer"
            ? "Let me put you through to one of the team now. One moment."
            : "Thanks for calling. Goodbye.";
      }
      break;
    }
  }

  if (!reply.trim()) {
    reply = "Sorry, could you say that again?";
  }

  if (input.persist && tokens > 0) {
    void recordUsage(ctx.business.id, "ai_tokens", tokens, input.callId);
  }

  return {
    reply: sanitiseForSpeech(reply),
    action,
    toolsUsed,
    knowledgeUsed: knowledge.map((k) => ({
      id: k.id,
      title: k.sourceTitle,
      score: Math.round(k.score * 100) / 100,
    })),
    tokens,
    appointmentId,
    captured,
  };
}

type ToolOutcome = {
  message: string;
  action?: TurnAction;
  appointmentId?: string;
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  input: RunTurnInput,
  ctx: CallContext,
  captured: CapturedDetails
): Promise<ToolOutcome> {
  const str = (key: string): string | undefined => {
    const value = args[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  switch (name) {
    case "capture_lead": {
      captured.name ??= str("name");
      captured.phone ??= str("phone") ?? input.callerPhone;
      captured.email ??= str("email");
      captured.address ??= str("address");
      captured.service ??= str("service");
      captured.message ??= str("notes");
      if (args.urgent === true) captured.urgent = true;
      return { message: "Saved. Their details are recorded against this call." };
    }

    case "take_message": {
      captured.name ??= str("name");
      captured.phone ??= str("phone") ?? input.callerPhone;
      captured.message = str("message") ?? captured.message;
      return { message: "Message recorded and the business has been notified." };
    }

    case "check_availability": {
      const serviceName = str("service");
      const service = matchService(ctx, serviceName);
      const preferred = str("preferredDate");

      let onDate: { year: number; month: number; day: number } | undefined;
      if (preferred) {
        const parts = preferred.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (parts) {
          onDate = { year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) };
        }
      }

      const slots = await findSlots(ctx.business.id, {
        hours: ctx.hours,
        timezone: ctx.business.timezone,
        durationMin: service?.durationMin ?? 60,
        limit: 3,
        onDate,
      });

      if (slots.length === 0) {
        return {
          message: onDate
            ? "Nothing is free on that day. Offer the caller a different day, and do not invent a time."
            : "No appointment times are available. Offer to take their details for a callback instead.",
        };
      }

      return {
        message:
          `Available: ${slots.map((s) => `${s.label} (book as ${toLocalIso(s.startsAt, ctx.business.timezone)})`).join("; ")}. ` +
          `Offer these to the caller. Do not offer any other time.`,
      };
    }

    case "book_appointment": {
      const startLocal = str("startsAt");
      const customerName = str("customerName");
      if (!startLocal || !customerName) {
        return { message: "Missing the time or the caller's name. Ask for whichever is missing." };
      }

      const startsAt = localToUtc(startLocal, ctx.business.timezone);
      if (!startsAt || startsAt.getTime() < Date.now()) {
        return { message: "That time is not valid or is in the past. Check availability again." };
      }

      const service = matchService(ctx, str("service"));
      const endsAt = new Date(startsAt.getTime() + (service?.durationMin ?? 60) * 60_000);

      if (!isOpenAt(ctx.hours, ctx.business.timezone, startsAt)) {
        return { message: "The business is closed at that time. Offer a time inside opening hours." };
      }

      if (!(await isSlotFree(ctx.business.id, startsAt, endsAt))) {
        return { message: "That time has just been taken. Check availability again and offer another." };
      }

      captured.name ??= customerName;
      captured.phone ??= str("customerPhone") ?? input.callerPhone;
      captured.service ??= service?.name ?? str("service");

      const spoken = describeSlot(startsAt, ctx.business.timezone);

      if (!input.persist) {
        return {
          message: `Booked (test mode — nothing was saved): ${spoken}. Confirm it back to the caller.`,
        };
      }

      const customer = await upsertCustomer(ctx.business.id, {
        name: customerName,
        phone: captured.phone,
      });

      const appointment = await db.appointment.create({
        data: {
          businessId: ctx.business.id,
          customerId: customer?.id ?? null,
          serviceId: service?.id ?? null,
          callId: input.callId ?? null,
          title: `${service?.name ?? captured.service ?? "Appointment"} — ${customerName}`,
          startsAt,
          endsAt,
          status: "confirmed",
          notes: str("notes") ?? null,
        },
      });

      void recordUsage(ctx.business.id, "appointments", 1, appointment.id);

      return {
        message: `Booked for ${spoken}. Confirm the day and time back to the caller.`,
        appointmentId: appointment.id,
      };
    }

    case "transfer_call": {
      const number = ctx.agent.transferNumber || ctx.agent.fallbackNumber || null;
      const reason = str("reason") ?? "caller requested a person";
      if (!number) {
        return {
          message:
            "No transfer number is configured, so you cannot put them through. Take their details for a callback instead.",
        };
      }
      return {
        message: "Transferring now. Say one short line telling the caller you are putting them through.",
        action: { type: "transfer", number, reason },
      };
    }

    case "end_call": {
      return {
        message: "Ending the call. Say a short goodbye.",
        action: { type: "hangup", reason: str("reason") ?? "caller finished" },
      };
    }

    default:
      return { message: `Unknown tool "${name}".` };
  }
}

function matchService(ctx: CallContext, name?: string) {
  if (!name) return ctx.business.services[0] ?? null;
  const needle = name.toLowerCase();
  return (
    ctx.business.services.find((s) => s.name.toLowerCase() === needle) ??
    ctx.business.services.find(
      (s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase())
    ) ??
    ctx.business.services[0] ??
    null
  );
}

/** Deduplicates a caller on phone number within the tenant. */
export async function upsertCustomer(
  businessId: string,
  details: { name?: string; phone?: string; email?: string; address?: string }
) {
  if (!details.phone && !details.name) return null;

  if (details.phone) {
    return db.customer.upsert({
      where: { businessId_phone: { businessId, phone: details.phone } },
      update: {
        ...(details.name && { name: details.name }),
        ...(details.email && { email: details.email }),
        ...(details.address && { addressLine: details.address }),
      },
      create: {
        businessId,
        phone: details.phone,
        name: details.name ?? null,
        email: details.email ?? null,
        addressLine: details.address ?? null,
      },
    });
  }

  return db.customer.create({
    data: {
      businessId,
      name: details.name ?? null,
      email: details.email ?? null,
      addressLine: details.address ?? null,
    },
  });
}

/** "2026-05-14T10:30" in the business's timezone — the format tools expect. */
function toLocalIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/**
 * Strips anything a text-to-speech engine would read out literally. The prompt
 * asks the model to avoid these, but a rogue asterisk should never be spoken.
 */
export function sanitiseForSpeech(text: string): string {
  return text
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\[[^\]]*\]\(([^)]*)\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
