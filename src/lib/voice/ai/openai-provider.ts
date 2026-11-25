import "server-only";
import OpenAI from "openai";
import type {
  AIProvider, ChatOptions, ChatResult, ToolCall,
} from "./types";
import { AINotConfiguredError } from "./types";

/**
 * The OpenAI adapter. The client is built lazily — constructing it at import
 * time throws during `next build` when no key is set, taking down routes that
 * never touch AI.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly embeddingDimensions = 1536;

  private client: OpenAI | null = null;
  private readonly chatModel = process.env.AI_CHAT_MODEL || "gpt-4o";
  private readonly embeddingModel = process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

  isConfigured(): boolean {
    return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
  }

  private get sdk(): OpenAI {
    if (!this.isConfigured()) throw new AINotConfiguredError(this.name);
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_BASE_URL || undefined,
      });
    }
    return this.client;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const completion = await this.sdk.chat.completions.create({
      model: options.model || this.chatModel,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 300,
      ...(options.json && { response_format: { type: "json_object" as const } }),
      ...(options.tools?.length && {
        tools: options.tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
      messages: options.messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool" as const, content: m.content, tool_call_id: m.toolCallId ?? "" };
        }
        if (m.role === "assistant" && m.toolCalls?.length) {
          // The tool results that follow are only valid as a reply to an
          // assistant message that carries the matching tool_call ids.
          return {
            role: "assistant" as const,
            content: m.content || null,
            tool_calls: m.toolCalls.map((t) => ({
              id: t.id,
              type: "function" as const,
              function: { name: t.name, arguments: JSON.stringify(t.arguments) },
            })),
          };
        }
        return { role: m.role as "system" | "user" | "assistant", content: m.content };
      }),
    });

    const choice = completion.choices[0];
    const toolCalls: ToolCall[] = [];

    for (const call of choice?.message?.tool_calls ?? []) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // A malformed argument blob means the tool cannot run; the caller
        // treats an empty object as "the model did not supply the details".
      }
      toolCalls.push({ id: call.id, name: call.function.name, arguments: args });
    }

    return {
      text: choice?.message?.content?.trim() ?? "",
      toolCalls,
      tokens: completion.usage?.total_tokens ?? 0,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  async embed(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const response = await this.sdk.embeddings.create({
      model: this.embeddingModel,
      input: inputs,
    });
    return response.data.map((d) => d.embedding as number[]);
  }
}
