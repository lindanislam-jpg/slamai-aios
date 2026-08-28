import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
import { aiError, openAIUnavailable, parseBody, requireUserId, unauthorized } from "@/lib/api";

const schema = z.object({
  text:     z.string().min(1, "Document text required"),
  question: z.string().optional(),
  mode:     z.enum(["summarize", "extract", "analyze", "qa"]).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const unavailable = openAIUnavailable();
  if (unavailable) return unavailable;

  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const { text, question, mode } = data;

  const modePrompts: Record<string, string> = {
    summarize: "Provide a comprehensive summary of this document. Highlight key points, main findings, and important conclusions.",
    extract:   "Extract and list all key data points, numbers, names, dates, and important facts from this document.",
    analyze:   "Analyze this document thoroughly. Identify themes, patterns, risks, opportunities, and provide actionable insights.",
    qa:        question ? `Answer this question based on the document: "${question}"` : "What are the main points of this document?",
  };

  const prompt = modePrompts[mode || "summarize"];

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert document analyst. Provide clear, structured, and actionable insights from documents." },
        { role: "user",   content: `${prompt}\n\nDOCUMENT:\n${text.slice(0, 8000)}` },
      ],
      max_tokens: 2000,
    });
    return NextResponse.json({ result: completion.choices[0]?.message?.content || "" });
  } catch (err) {
    return aiError(err, "documents/analyze");
  }
}
