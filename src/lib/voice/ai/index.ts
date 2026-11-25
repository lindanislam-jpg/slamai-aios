import "server-only";
import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai-provider";

/**
 * Provider selection. `AI_PROVIDER` names the adapter; adding a vendor means
 * adding a case here and a file next to this one — no caller changes.
 */
let instance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (instance) return instance;
  const configured = (process.env.AI_PROVIDER || "openai").toLowerCase();
  switch (configured) {
    case "openai":
    default:
      instance = new OpenAIProvider();
  }
  return instance;
}

export function isAIConfigured(): boolean {
  return getAIProvider().isConfigured();
}

export * from "./types";
