/**
 * Platform event keys. These are the contract for notification rules and for
 * outbound webhooks (n8n, Zapier, a CRM), so the strings are stable API.
 */

export const EVENTS = [
  "call.started",
  "call.ended",
  "call.missed",
  "call.transferred",
  "call.emergency",
  "transcript.completed",
  "lead.created",
  "lead.high_value",
  "appointment.booked",
  "appointment.cancelled",
  "message.taken",
  "agent.unanswered",
] as const;

export type EventKey = (typeof EVENTS)[number];

export const EVENT_LABELS: Record<EventKey, string> = {
  "call.started": "A call starts",
  "call.ended": "A call ends",
  "call.missed": "A call is missed",
  "call.transferred": "A call is transferred to a human",
  "call.emergency": "An urgent call comes in",
  "transcript.completed": "A transcript is ready",
  "lead.created": "A new lead is captured",
  "lead.high_value": "A high-value lead is captured",
  "appointment.booked": "An appointment is booked",
  "appointment.cancelled": "An appointment is cancelled",
  "message.taken": "The AI takes a message",
  "agent.unanswered": "The AI could not answer a question",
};

export function isEventKey(value: string): value is EventKey {
  return (EVENTS as readonly string[]).includes(value);
}

/** Score at or above which a lead counts as high value. */
export const HIGH_VALUE_LEAD_SCORE = 75;
