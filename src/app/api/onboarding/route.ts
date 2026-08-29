import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson } from "@/lib/api";
import { DEFAULT_GREETING, DEFAULT_SYSTEM_PROMPT } from "@/lib/voice-defaults";

/**
 * Setup progress is derived from the account's real state on every request
 * rather than stored as per-step flags — a flag can drift out of sync with
 * reality (someone clears their number and the tick would stay green), and
 * derived state cannot.
 */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const [user, agent, realCalls, contacts] = await Promise.all([
    db.user.findUnique({
      where: { id: gate.userId },
      select: { onboardingDismissed: true },
    }),
    db.voiceAgent.findUnique({ where: { userId: gate.userId } }),
    // A call with a Twilio SID is one that genuinely came through the phone
    // line; manually logged calls don't prove the agent is working.
    db.callLog.count({ where: { userId: gate.userId, callSid: { not: null } } }),
    db.contact.count({ where: { userId: gate.userId } }),
  ]);

  const steps = [
    {
      id: "number",
      title: "Connect your phone number",
      description: "Buy a number in Twilio and paste it in, so calls have somewhere to land.",
      done: Boolean(agent?.phoneNumber),
      href: "/voice-ai",
      cta: "Add your number",
    },
    {
      id: "greeting",
      title: "Write your greeting",
      description: "The first thing every caller hears. Use your business name.",
      done: Boolean(agent && agent.greeting.trim() && agent.greeting.trim() !== DEFAULT_GREETING),
      href: "/voice-ai",
      cta: "Write it",
    },
    {
      id: "instructions",
      title: "Tell the agent about your business",
      description: "What you do, what you charge, and what it should never promise.",
      done: Boolean(agent && agent.systemPrompt.trim() && agent.systemPrompt.trim() !== DEFAULT_SYSTEM_PROMPT),
      href: "/voice-ai",
      cta: "Add instructions",
    },
    {
      id: "transfer",
      title: "Set your transfer number",
      description: "Where the call goes when someone asks for a person. Optional, but worth it.",
      done: Boolean(agent?.transferNumber),
      href: "/voice-ai",
      cta: "Set it",
      optional: true,
    },
    {
      id: "live",
      title: "Put the agent live",
      description: "Until you activate it, calls to your number aren't answered.",
      done: Boolean(agent?.isActive),
      href: "/voice-ai",
      cta: "Go live",
    },
    {
      id: "testcall",
      title: "Ring it yourself",
      description: "Call your own number and have a proper conversation with it before a customer does.",
      done: realCalls > 0,
      href: "/voice-ai",
      cta: "See call history",
    },
    {
      id: "crm",
      title: "Check the lead landed",
      description: "After a call, the caller should appear in your CRM on their own.",
      done: contacts > 0,
      href: "/crm",
      cta: "Open CRM",
    },
  ];

  // Optional steps count toward the total only once done, so skipping one
  // never leaves the bar permanently short of full.
  const required = steps.filter((s) => !s.optional);
  const completed = required.filter((s) => s.done).length;

  return NextResponse.json({
    steps,
    completed,
    total: required.length,
    allDone: completed === required.length,
    dismissed: user?.onboardingDismissed ?? false,
  });
}

type OnboardingPatch = { dismissed?: boolean };

export async function PATCH(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<OnboardingPatch>(req);
  if (typeof body?.dismissed !== "boolean") {
    return NextResponse.json({ error: "dismissed must be true or false" }, { status: 400 });
  }

  await db.user.update({
    where: { id: gate.userId },
    data:  { onboardingDismissed: body.dismissed },
  });

  return NextResponse.json({ ok: true });
}
