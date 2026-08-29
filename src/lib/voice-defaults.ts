/**
 * The starting greeting and instructions for a new voice agent.
 *
 * These must stay identical to the `@default` values in prisma/schema.prisma —
 * the setup checklist compares against them to tell whether someone has
 * actually written their own copy or is still on the stock text.
 */
export const DEFAULT_GREETING =
  "Hello, thanks for calling. How can I help you today?";

export const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly phone receptionist. Keep replies to one or two short sentences, ask one question at a time, and offer to book a callback. Never invent prices or availability.";
