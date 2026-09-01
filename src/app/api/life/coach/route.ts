import { NextResponse } from "next/server";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";
import { localAnswer, type CoachSnapshot } from "@/lib/life/coach";

export const runtime = "nodejs";

const SYSTEM = `You are the AI Life Coach inside Elite Life OS, a personal operating system built on eight habits:
Win Tomorrow Tonight, Protect Your Morning, Mindful Journalling, Learn Daily, Environment Engineering,
Measure What Matters, Fight For Momentum, Choose Hard.

You are given a JSON snapshot of the user's real tracked data. Rules:
- Reason ONLY from the snapshot. Never invent numbers, streaks or events that are not in it.
- Be direct, specific and warm. No therapy voice, no hype, no emoji.
- Lead with the observation, then the diagnosis, then ONE action. Never more than one action.
- Three short paragraphs maximum. Use **bold** for the one thing that matters most.
- If the data is thin, say so plainly instead of guessing.`;

interface Body {
  question?: string;
  snapshot?: CoachSnapshot;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const snapshot = body.snapshot;

  if (!question || !snapshot) {
    return NextResponse.json({ error: "question and snapshot are required." }, { status: 400 });
  }

  // No key configured: answer from the local engine and say so. The client shows
  // a "local analysis" badge — the coach is never presented as a model when it isn't.
  if (!isOpenAIConfigured()) {
    return NextResponse.json({
      source: "local" as const,
      answer: localAnswer(snapshot, question),
      note: "Local analysis — set OPENAI_API_KEY to enable the model-backed coach.",
    });
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.LIFE_COACH_MODEL ?? "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Snapshot:\n${JSON.stringify(snapshot)}\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) throw new Error("Empty completion");

    return NextResponse.json({ source: "model" as const, answer });
  } catch (err) {
    // The model failed; degrade to the local engine rather than to an error screen.
    return NextResponse.json({
      source: "local" as const,
      answer: localAnswer(snapshot, question),
      note: `Model unavailable (${err instanceof Error ? err.message : "unknown error"}) — answered from local analysis.`,
    });
  }
}
