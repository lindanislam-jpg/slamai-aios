import "server-only";
import { getIndustry } from "./industries";
import { getPersonality } from "./personalities";
import { parseTriggers, triggerInstructions } from "./transfer-rules";
import { describeHours, describeNow, type HourRow } from "./hours";
import type { RetrievedChunk } from "./retrieval";

/**
 * Composes the receptionist's system prompt.
 *
 * The ordering matters: identity, then hard rules, then the business's own
 * facts, then the owner's custom instructions. Custom instructions come last
 * so an owner can shape tone and process — but the hard rules above them are
 * what stop the agent inventing prices, giving advice it must not give, or
 * pretending to be a person.
 */

export type PromptContext = {
  business: {
    name: string;
    industry: string;
    description: string | null;
    timezone: string;
    city: string | null;
    website: string | null;
    email: string | null;
  };
  agent: {
    name: string;
    personality: string;
    customInstructions: string | null;
    emergencyInstructions: string | null;
    bookingEnabled: boolean;
    leadCaptureEnabled: boolean;
    transferEnabled: boolean;
    transferTriggers: string;
  };
  services: { name: string; price: number | null; priceNote: string | null; durationMin: number }[];
  hours: HourRow[];
  isOpen: boolean;
  afterHoursMode: string;
  knowledge?: RetrievedChunk[];
  /** Set when a caller is already known, so the agent does not re-ask. */
  knownCaller?: { name: string | null; phone: string | null } | null;
};

export function buildSystemPrompt(ctx: PromptContext): string {
  const industry = getIndustry(ctx.business.industry);
  const personality = getPersonality(ctx.agent.personality);
  const sections: string[] = [];

  sections.push(
    `You are ${ctx.agent.name}, the AI phone assistant for ${ctx.business.name}` +
      (ctx.business.city ? ` in ${ctx.business.city}` : "") +
      `. You are answering an inbound phone call right now.`
  );

  sections.push(
    [
      "HOW TO SPEAK",
      "- Your reply is read aloud, so write only spoken words. Never use lists, bullet points, markdown, emoji, or symbols.",
      "- Keep every reply under 40 words. Two short sentences at most.",
      "- Ask one question at a time and wait for the answer.",
      "- Never repeat a question the caller has already answered.",
      "- Read phone numbers and times back to confirm them before you act on them.",
      personality.guidance,
    ].join("\n")
  );

  sections.push(
    [
      "RULES YOU MUST NOT BREAK",
      "- You are an AI assistant. If the caller asks whether you are a real person, say plainly that you are an AI assistant for the business. Never claim to be human.",
      "- Never invent a price, a discount, an availability, a policy, or a fact about the business. If it is not in the information below, say you will have someone confirm it.",
      "- Never give medical, legal, or financial advice.",
      "- If you do not know something, say so and offer to take the caller's details for a callback.",
      "- Do not read back a caller's personal details to anyone but that caller, and do not discuss other customers.",
      "- If the caller describes a life-threatening emergency, tell them to hang up and call the emergency services immediately.",
    ].join("\n")
  );

  sections.push(
    [
      "THE BUSINESS",
      `Name: ${ctx.business.name}`,
      `Trade: ${industry.label}`,
      ctx.business.description ? `About: ${ctx.business.description}` : null,
      ctx.business.website ? `Website: ${ctx.business.website}` : null,
      `Opening hours: ${describeHours(ctx.hours)}`,
      `Right now it is ${describeNow(ctx.business.timezone)} (${ctx.business.timezone}) and the business is ${ctx.isOpen ? "OPEN" : "CLOSED"}.`,
      industry.guidance,
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (ctx.services.length > 0) {
    sections.push(
      [
        "SERVICES YOU MAY DISCUSS (these prices are the only prices you may quote)",
        ...ctx.services.map((s) => {
          const price =
            s.price !== null && s.price !== undefined
              ? `${s.price}`
              : s.priceNote || "price on enquiry — do not guess";
          return `- ${s.name}: ${price}, about ${s.durationMin} minutes`;
        }),
      ].join("\n")
    );
  } else {
    sections.push(
      "SERVICES\nNo service list has been set up. Never quote a price; offer to have someone call the customer back with pricing."
    );
  }

  if (!ctx.isOpen) {
    sections.push(`AFTER HOURS\n${afterHoursGuidance(ctx.afterHoursMode)}`);
  }

  if (ctx.agent.emergencyInstructions) {
    sections.push(`EMERGENCY PROCEDURE\n${ctx.agent.emergencyInstructions}`);
  } else if (industry.emergencyKeywords.length > 0) {
    sections.push(
      `EMERGENCY PROCEDURE\nTreat the call as urgent if the caller mentions any of: ${industry.emergencyKeywords.join(", ")}. ` +
        `Take their name, phone number and address straight away, then tell them someone will contact them as a priority.`
    );
  }

  const goals: string[] = [];
  if (ctx.agent.leadCaptureEnabled) {
    goals.push(
      "- Capture the caller's name and a phone number you can reach them on, and what they need. Call capture_lead once you have them."
    );
  }
  if (ctx.agent.bookingEnabled) {
    goals.push(
      "- If they want an appointment, use check_availability first, then book_appointment. Confirm the service, the date and the time out loud before booking."
    );
  }
  if (ctx.agent.transferEnabled) {
    const triggers = triggerInstructions(parseTriggers(ctx.agent.transferTriggers));
    if (triggers.length > 0) {
      goals.push(`- Call transfer_call if ${triggers.join(", or if ")}.`);
    }
  }
  goals.push("- Call take_message when the caller just wants to leave a message.");
  goals.push("- Call end_call once the caller has what they need and has said goodbye.");

  sections.push(["WHAT YOU ARE TRYING TO DO ON THIS CALL", ...goals].join("\n"));

  if (ctx.knownCaller?.name) {
    sections.push(
      `THE CALLER\nThis number belongs to ${ctx.knownCaller.name}, who has called before. Greet them by name and do not ask for their number again.`
    );
  }

  if (ctx.knowledge && ctx.knowledge.length > 0) {
    sections.push(
      [
        "BUSINESS INFORMATION RELEVANT TO WHAT THE CALLER JUST ASKED",
        "Use only what is written here. If it does not answer the question, say you will have someone confirm.",
        ...ctx.knowledge.map((k, i) => `[${i + 1}] From "${k.sourceTitle}": ${k.content}`),
      ].join("\n")
    );
  }

  if (ctx.agent.customInstructions) {
    sections.push(
      `INSTRUCTIONS FROM THE BUSINESS OWNER\n${ctx.agent.customInstructions}\n` +
        `(Follow these unless they conflict with the rules you must not break above.)`
    );
  }

  return sections.join("\n\n");
}

function afterHoursGuidance(mode: string): string {
  switch (mode) {
    case "answer":
      return "The business is closed, but you should still help fully: answer questions and book appointments for the next working day.";
    case "emergency_only":
      return "The business is closed. Handle genuine emergencies by taking full details and transferring or escalating. For anything else, take a message and say someone will call back when the business reopens.";
    case "voicemail":
      return "The business is closed. Take a short message and the caller's number, then end the call politely.";
    case "message":
    default:
      return "The business is closed. Answer what you can from the information you have, then take the caller's name, number and message so someone can call them back when the business reopens.";
  }
}

/** Prompt used after a call to produce the summary and the lead signals. */
export const ANALYSIS_PROMPT = `You are analysing a finished phone call for a business.
Read the transcript and reply with a JSON object and nothing else, using exactly these keys:

{
  "summary": "2-3 sentences, plain English, what the caller wanted and what happened",
  "intent": one of "book" | "quote" | "enquiry" | "support" | "complaint" | "spam" | "unknown",
  "urgency": one of "emergency" | "urgent" | "normal" | "browsing",
  "sentiment": one of "positive" | "neutral" | "negative",
  "customerName": the caller's name if they gave one, otherwise null,
  "customerEmail": their email if they gave one, otherwise null,
  "customerPhone": a phone number they gave, otherwise null,
  "serviceRequested": the service they asked about, otherwise null,
  "namedService": true if they named a service the business offers,
  "highValue": true if they described a large or high-value job,
  "readyToProceed": true if they asked to go ahead or to be called back,
  "isEmergency": true if this was an emergency,
  "unansweredQuestion": a question you could not answer, otherwise null
}

Base every field only on what is in the transcript. Do not guess. Use null rather than inventing a value.`;
