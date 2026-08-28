import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * Lazily construct the OpenAI client. Instantiating at module scope throws
 * during `next build` (page-data collection imports the route module before any
 * runtime env vars exist), which fails the whole deploy.
 */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
