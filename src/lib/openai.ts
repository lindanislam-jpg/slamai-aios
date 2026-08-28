import OpenAI from "openai";

let client: OpenAI | null = null;

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Lazily create the OpenAI client. Instantiating at module scope throws when
 * OPENAI_API_KEY is unset, which breaks `next build` while it collects page
 * data for these routes.
 */
export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
