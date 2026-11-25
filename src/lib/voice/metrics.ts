/**
 * The metered metrics. Kept apart from usage.ts, which is server-only, so the
 * billing and usage pages can render these labels in the browser.
 */

export const METRICS = [
  "voice_minutes",
  "calls",
  "ai_tokens",
  "knowledge_searches",
  "sms",
  "appointments",
  "transfers",
] as const;

export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  voice_minutes: "Voice minutes",
  calls: "Calls",
  ai_tokens: "AI tokens",
  knowledge_searches: "Knowledge searches",
  sms: "SMS sent",
  appointments: "Appointments booked",
  transfers: "Calls transferred",
};
