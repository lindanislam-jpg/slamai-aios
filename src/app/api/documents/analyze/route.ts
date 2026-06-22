import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, question, mode } = await req.json();
  if (!text) return NextResponse.json({ error: "Document text required" }, { status: 400 });

  const modePrompts: Record<string, string> = {
    summarize: "Provide a comprehensive summary of this document. Highlight key points, main findings, and important conclusions.",
    extract:   "Extract and list all key data points, numbers, names, dates, and important facts from this document.",
    analyze:   "Analyze this document thoroughly. Identify themes, patterns, risks, opportunities, and provide actionable insights.",
    qa:        question ? `Answer this question based on the document: "${question}"` : "What are the main points of this document?",
  };

  const prompt = modePrompts[mode || "summarize"];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert document analyst. Provide clear, structured, and actionable insights from documents." },
      { role: "user",   content: `${prompt}\n\nDOCUMENT:\n${text.slice(0, 8000)}` },
    ],
    max_tokens: 2000,
  });

  return NextResponse.json({ result: completion.choices[0]?.message?.content || "" });
}
