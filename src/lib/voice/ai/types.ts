/**
 * The AI provider contract.
 *
 * Everything in SlamAI Voice that talks to a model goes through this
 * interface, so swapping OpenAI for another vendor is one adapter, not a
 * rewrite. Adapters live alongside this file and are selected in ./index.ts.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Present on tool results. */
  toolCallId?: string;
  name?: string;
  /**
   * Present on an assistant message that asked for tools. Providers require
   * this to be echoed back, otherwise the tool results that follow have
   * nothing to attach to and the request is rejected.
   */
  toolCalls?: ToolCall[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatResult = {
  text: string;
  toolCalls: ToolCall[];
  /** Total tokens billed for this request, when the provider reports it. */
  tokens: number;
  finishReason: string;
};

export type ChatOptions = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** Overrides the provider default model. */
  model?: string;
  /** Ask the model to reply with a JSON object. */
  json?: boolean;
};

export interface AIProvider {
  readonly name: string;
  /** Whether credentials are present. Callers must degrade gracefully if false. */
  isConfigured(): boolean;
  chat(options: ChatOptions): Promise<ChatResult>;
  /** Returns one vector per input string, in order. */
  embed(inputs: string[]): Promise<number[][]>;
  readonly embeddingDimensions: number;
}

/** Thrown when a provider is called without credentials. */
export class AINotConfiguredError extends Error {
  constructor(provider: string) {
    super(`The ${provider} AI provider is not configured. Set its API key to enable AI features.`);
    this.name = "AINotConfiguredError";
  }
}
