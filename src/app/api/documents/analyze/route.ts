import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { aiError, openAIUnavailable, parseBody, requireUserId, unauthorized } from "@/lib/api";

const schema = z.object({
  text:     z.string().min(1, "Document text required"),
  question: z.string().optional(),
  mode:     z.enum(["summarize", "extract", "analyze", "qa"]).optional(),
  name:     z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const unavailable = openAIUnavailable();
  if (unavailable) return unavailable;

  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const { text, question, name } = data;
  const mode = data.mode || "summarize";

  const modePrompts: Record<string, string> = {
    summarize: "Provide a comprehensive summary of this document. Highlight key points, main findings, and important conclusions.",
    extract:   "Extract and list all key data points, numbers, names, dates, and important facts from this document.",
    analyze:   "Analyze this document thoroughly. Identify themes, patterns, risks, opportunities, and provide actionable insights.",
    qa:        question ? `Answer this question based on the document: "${question}"` : "What are the main points of this document?",
  };

  let result: string;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert document analyst. Provide clear, structured, and actionable insights from documents." },
        { role: "user",   content: `${modePrompts[mode]}\n\nDOCUMENT:\n${text.slice(0, 8000)}` },
      ],
      max_tokens: 2000,
    });
    result = completion.choices[0]?.message?.content || "";
  } catch (err) {
    return aiError(err, "documents/analyze");
  }

  // Keep the analysis: without this the work is lost on reload and the
  // Documents counter on the dashboard never moves.
  const document = await db.document.create({
    data: {
      name: name?.trim() || "Pasted text",
      type: "text",
      size: text.length,
      mode,
      summary: result,
      userId,
    },
    select: { id: true, name: true, mode: true, size: true, summary: true, createdAt: true },
  });

  return NextResponse.json({ result, document });
}
