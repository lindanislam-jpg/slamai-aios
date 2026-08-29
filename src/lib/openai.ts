import OpenAI from "openai";

/**
 * Constructed on first use rather than at import time — a module-level client
 * throws during `next build` (and on any cold start) when the key isn't set,
 * taking down routes that don't even use it.
 */
let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — AI features are unavailable until it is configured.");
  }

  client = new OpenAI({ apiKey });
  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
