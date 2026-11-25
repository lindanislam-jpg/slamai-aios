import { z } from "zod";
import { ROLES } from "./roles";
import { EVENTS } from "./events";
import { INDUSTRIES } from "./industries";
import { PERSONALITIES } from "./personalities";

/**
 * Request schemas. Every mutating API route parses its body through one of
 * these, so no handler decides for itself what a valid payload looks like.
 */

const industryKeys = INDUSTRIES.map((i) => i.key) as [string, ...string[]];
const personalityKeys = PERSONALITIES.map((p) => p.key) as [string, ...string[]];

export const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Enter a phone number in international format, e.g. +353871234567");

/** Callers may give a number in any shape; we only require something dialable. */
const loosePhone = z.string().trim().min(6).max(32);

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(12, "Use at least 12 characters").max(200),
  businessName: z.string().trim().min(2).max(160),
  industry: z.enum(industryKeys).default("other"),
  phone: loosePhone.optional().or(z.literal("")),
  country: z.string().trim().length(2).default("IE"),
  timezone: z.string().trim().min(3).max(64).default("Europe/Dublin"),
});

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: loosePhone.optional().or(z.literal("")),
  addressLine: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  postcode: z.string().trim().max(32).optional().or(z.literal("")),
  country: z.string().trim().length(2).optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  industry: z.enum(industryKeys).optional(),
});

export const agentSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  personality: z.enum(personalityKeys).optional(),
  voice: z.string().trim().min(2).max(64).optional(),
  language: z.string().trim().min(2).max(16).optional(),
  speakingRate: z.number().min(0.7).max(1.3).optional(),
  greeting: z.string().trim().min(5).max(600).optional(),
  customInstructions: z.string().trim().max(4000).optional().or(z.literal("")),
  emergencyInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
  afterHoursMode: z.enum(["answer", "message", "emergency_only", "voicemail"]).optional(),
  bookingEnabled: z.boolean().optional(),
  leadCaptureEnabled: z.boolean().optional(),
  transferEnabled: z.boolean().optional(),
  transferNumber: e164.optional().or(z.literal("")),
  fallbackNumber: e164.optional().or(z.literal("")),
  transferTriggers: z.array(z.string().max(40)).max(20).optional(),
  maxTurns: z.number().int().min(5).max(60).optional(),
  isActive: z.boolean().optional(),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  priceNote: z.string().trim().max(160).optional().or(z.literal("")),
  durationMin: z.number().int().min(5).max(1440).default(60),
  isActive: z.boolean().default(true),
});

export const hoursSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      })
    )
    .length(7),
});

export const knowledgeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(["url", "pdf", "docx", "txt", "faq", "text"]),
  sourceUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  content: z.string().max(400_000).optional(),
  /** FAQ sources are supplied as question/answer pairs. */
  faqs: z
    .array(z.object({ question: z.string().trim().min(3).max(500), answer: z.string().trim().min(1).max(5000) }))
    .max(200)
    .optional(),
});

export const leadSchema = z.object({
  name: z.string().trim().max(160).optional().or(z.literal("")),
  phone: loosePhone.optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  serviceRequested: z.string().trim().max(200).optional().or(z.literal("")),
  summary: z.string().trim().max(4000).optional().or(z.literal("")),
  score: z.number().int().min(0).max(100).optional(),
  status: z.enum(["new", "contacted", "qualified", "booked", "won", "lost"]).optional(),
  estimatedValue: z.number().min(0).max(10_000_000).nullable().optional(),
  urgency: z.enum(["emergency", "urgent", "normal", "browsing"]).optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const appointmentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  startsAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  endsAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  serviceId: z.string().cuid().nullable().optional(),
  customerId: z.string().cuid().nullable().optional(),
  customerName: z.string().trim().max(160).optional().or(z.literal("")),
  customerPhone: loosePhone.optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).optional(),
});

export const inviteSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(ROLES as unknown as [string, ...string[]]),
});

/**
 * A notification target is whatever the channel actually needs, and a webhook
 * target is a URL the server will fetch. Typing it as a bare string let a
 * tenant point the server at an internal address, so each channel is checked
 * for the shape it means.
 */
export const notificationRuleSchema = z
  .object({
    event: z.enum(EVENTS as unknown as [string, ...string[]]),
    channel: z.enum(["email", "sms", "webhook"]),
    target: z.string().trim().min(3).max(400),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message });

    if (value.channel === "email" && !z.string().email().safeParse(value.target).success) {
      fail("Enter a valid email address.");
    }
    if (value.channel === "sms" && !e164.safeParse(value.target).success) {
      fail("Enter a mobile number in international format, e.g. +353871234567.");
    }
    if (value.channel === "webhook") {
      const url = z.string().url().safeParse(value.target);
      if (!url.success) {
        fail("Enter a valid https address.");
      } else if (!/^https?:$/.test(new URL(value.target).protocol)) {
        fail("Only http and https addresses can be used.");
      }
    }
  });

export const webhookEndpointSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(500),
  events: z.array(z.enum(EVENTS as unknown as [string, ...string[]])).max(EVENTS.length).default([]),
  isActive: z.boolean().default(true),
});

export const phoneNumberSchema = z.object({
  e164,
  label: z.string().trim().max(120).optional().or(z.literal("")),
  agentId: z.string().cuid().nullable().optional(),
  forwardTo: e164.optional().or(z.literal("")),
});

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: loosePhone.optional().or(z.literal("")),
  industry: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const testCallSchema = z.object({
  agentId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["caller", "agent"]), text: z.string().max(4000) }))
    .max(60)
    .default([]),
  /** Simulate the call arriving outside opening hours. */
  simulateAfterHours: z.boolean().default(false),
});

/** Turns a ZodError into one readable sentence for a toast. */
export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That input isn't valid.";
  const field = issue.path.filter((p) => typeof p === "string").join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
