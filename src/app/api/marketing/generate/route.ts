import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { aiError, openAIUnavailable, parseBody, requireUserId, unauthorized } from "@/lib/api";

const prompts: Record<string, string> = {
  linkedin:    "Write a professional LinkedIn post",
  instagram:   "Write an engaging Instagram caption with relevant hashtags",
  facebook:    "Write a Facebook post",
  blog:        "Write a full blog article with headings and subheadings",
  email:       "Write a compelling marketing email with subject line",
  "ad-copy":   "Write persuasive advertising copy",
  "video-script": "Write a YouTube video script with intro, main content, and outro",
};

const schema = z.object({
  type:  z.string().trim().min(1, "type and topic required"),
  topic: z.string().trim().min(1, "type and topic required"),
  tone:     z.string().trim().optional(),
  audience: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const unavailable = openAIUnavailable();
  if (unavailable) return unavailable;

  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const { type, topic, tone, audience } = data;

  const basePrompt = prompts[type] || "Write content";
  const systemMsg  = `You are an expert marketing copywriter. Create compelling, conversion-focused content.`;
  const userMsg    = `${basePrompt} about: "${topic}". Tone: ${tone || "professional"}. Target audience: ${audience || "general business"}. Make it engaging and action-oriented.`;

  let content: string;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      max_tokens: 1500,
    });
    content = completion.choices[0]?.message?.content || "";
  } catch (err) {
    return aiError(err, "marketing/generate");
  }

  // Saved as a draft campaign so generated copy survives a reload.
  const campaign = await db.campaign.create({
    data: {
      name: topic.slice(0, 120),
      type,
      platform: type,
      status: "draft",
      content,
      userId,
    },
    select: { id: true, name: true, type: true, status: true, content: true, createdAt: true },
  });

  return NextResponse.json({ content, campaign });
}
