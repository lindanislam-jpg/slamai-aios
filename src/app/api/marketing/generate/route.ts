import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const prompts: Record<string, string> = {
  linkedin:    "Write a professional LinkedIn post",
  instagram:   "Write an engaging Instagram caption with relevant hashtags",
  facebook:    "Write a Facebook post",
  blog:        "Write a full blog article with headings and subheadings",
  email:       "Write a compelling marketing email with subject line",
  "ad-copy":   "Write persuasive advertising copy",
  "video-script": "Write a YouTube video script with intro, main content, and outro",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, topic, tone, audience } = await req.json();
  if (!type || !topic) return NextResponse.json({ error: "type and topic required" }, { status: 400 });

  const basePrompt = prompts[type] || "Write content";
  const systemMsg  = `You are an expert marketing copywriter. Create compelling, conversion-focused content.`;
  const userMsg    = `${basePrompt} about: "${topic}". Tone: ${tone || "professional"}. Target audience: ${audience || "general business"}. Make it engaging and action-oriented.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
    max_tokens: 1500,
  });

  const content = completion.choices[0]?.message?.content || "";
  return NextResponse.json({ content });
}
