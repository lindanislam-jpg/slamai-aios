import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, message, conversationId } = await req.json();
  if (!agentId || !message) return NextResponse.json({ error: "agentId and message required" }, { status: 400 });

  const agent = await db.aIAgent.findFirst({ where: { id: agentId, userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await db.conversation.create({
      data: { agentId, userId: session.user.id, title: message.slice(0, 50) },
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

  const completion = await openai.chat.completions.create({
    model: agent.model || "gpt-4o",
    messages,
    max_tokens: 1024,
  });

  const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

  await db.message.create({ data: { role: "assistant", content: reply, conversationId: convId } });

  return NextResponse.json({ reply, conversationId: convId });
}
