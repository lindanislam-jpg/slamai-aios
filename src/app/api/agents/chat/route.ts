import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { aiError, openAIUnavailable, parseBody, requireUserId, unauthorized } from "@/lib/api";
import type OpenAI from "openai";

const schema = z.object({
  agentId: z.string().min(1, "agentId and message required"),
  message: z.string().min(1, "agentId and message required"),
  conversationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const unavailable = openAIUnavailable();
  if (unavailable) return unavailable;

  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const { agentId, message } = data;

  const agent = await db.aIAgent.findFirst({ where: { id: agentId, userId } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Get or create conversation, scoped to this user so an id can't be borrowed
  let convId = data.conversationId;
  if (convId) {
    const existing = await db.conversation.findFirst({ where: { id: convId, userId } });
    if (!existing) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  } else {
    const conv = await db.conversation.create({
      data: { agentId, userId, title: message.slice(0, 50) },
    });
    convId = conv.id;
  }

  // Save user message
  await db.message.create({ data: { role: "user", content: message, conversationId: convId } });

  // Get history
  const history = await db.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: agent.systemPrompt ||
        `You are ${agent.name}, a specialized AI assistant for ${agent.type}. Be helpful, professional, and concise.`,
    },
    ...history.slice(0, -1).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  let reply: string;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: agent.model || "gpt-4o",
      messages,
      max_tokens: 1024,
    });
    reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (err) {
    return aiError(err, "agents/chat");
  }

  await db.message.create({ data: { role: "assistant", content: reply, conversationId: convId } });

  return NextResponse.json({ reply, conversationId: convId });
}
