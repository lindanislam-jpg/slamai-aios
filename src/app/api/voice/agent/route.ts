import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";
import { VOICES } from "@/lib/voices";


export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  // The agent is created on first visit so the page always has something to edit.
  const agent = await db.voiceAgent.upsert({
    where:  { userId: gate.userId },
    update: {},
    create: { userId: gate.userId },
  });

  return NextResponse.json({
    ...agent,
    voices: VOICES,
    twilioConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
    webhookBase: process.env.TWILIO_WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL || "",
  });
}

type AgentPatch = {
  phoneNumber?: string | null;
  isActive?: boolean;
  greeting?: string;
  systemPrompt?: string;
  voice?: string;
  transferNumber?: string | null;
  captureLeads?: boolean;
  maxTurns?: number;
};

/** Twilio numbers are E.164: a plus sign then up to 15 digits. */
const E164 = /^\+[1-9]\d{6,14}$/;

export async function PATCH(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<AgentPatch>(req);
  if (!body) return badRequest("Invalid body");

  const phoneNumber = body.phoneNumber?.trim() || null;
  if (phoneNumber && !E164.test(phoneNumber)) {
    return badRequest("Phone number must be in international format, e.g. +35315551234");
  }

  const transferNumber = body.transferNumber?.trim() || null;
  if (transferNumber && !E164.test(transferNumber)) {
    return badRequest("Transfer number must be in international format, e.g. +353871234567");
  }

  // A number can only route to one account, so reject a collision clearly
  // rather than letting the unique constraint surface as a 500.
  if (phoneNumber) {
    const taken = await db.voiceAgent.findFirst({
      where: { phoneNumber, NOT: { userId: gate.userId } },
    });
    if (taken) return badRequest("That phone number is already connected to another account.");
  }

  if (body.isActive && !phoneNumber) {
    return badRequest("Add your Twilio phone number before activating the agent.");
  }

  const agent = await db.voiceAgent.upsert({
    where:  { userId: gate.userId },
    create: {
      userId: gate.userId,
      phoneNumber,
      transferNumber,
      ...(body.isActive     !== undefined && { isActive: body.isActive }),
      ...(body.greeting     !== undefined && { greeting: body.greeting }),
      ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
      ...(body.voice        !== undefined && { voice: body.voice }),
      ...(body.captureLeads !== undefined && { captureLeads: body.captureLeads }),
    },
    update: {
      ...(body.phoneNumber    !== undefined && { phoneNumber }),
      ...(body.transferNumber !== undefined && { transferNumber }),
      ...(body.isActive       !== undefined && { isActive: body.isActive }),
      ...(body.greeting       !== undefined && { greeting: body.greeting.trim() }),
      ...(body.systemPrompt   !== undefined && { systemPrompt: body.systemPrompt.trim() }),
      ...(body.voice          !== undefined && { voice: body.voice }),
      ...(body.captureLeads   !== undefined && { captureLeads: body.captureLeads }),
      ...(body.maxTurns       !== undefined && { maxTurns: Math.max(4, Math.min(60, body.maxTurns)) }),
    },
  });

  return NextResponse.json(agent);
}
