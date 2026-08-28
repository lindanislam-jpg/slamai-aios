import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const [calls, aggregate, booked, leads] = await Promise.all([
    db.callLog.findMany({
      where: { userId: gate.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { contact: { select: { id: true, name: true, email: true, stage: true } } },
    }),
    db.callLog.aggregate({
      where: { userId: gate.userId },
      _count: true,
      _sum: { durationSec: true },
    }),
    db.callLog.count({ where: { userId: gate.userId, outcome: { in: ["booked", "qualified"] } } }),
    db.callLog.count({ where: { userId: gate.userId, contactId: { not: null } } }),
  ]);

  return NextResponse.json({
    calls: calls.map((c) => ({
      ...c,
      // Hand the UI a parsed transcript rather than a JSON string.
      transcript: (() => {
        try { return JSON.parse(c.transcript || "[]"); } catch { return []; }
      })(),
    })),
    stats: {
      total:        aggregate._count,
      totalSeconds: aggregate._sum.durationSec || 0,
      booked,
      leads,
      bookingRate:  aggregate._count ? Math.round((booked / aggregate._count) * 100) : 0,
    },
  });
}

type CallBody = {
  caller?: string;
  direction?: string;
  durationSec?: number;
  outcome?: string;
  summary?: string;
  recordingUrl?: string;
};

/**
 * Records a call by hand. Real calls arrive through the Twilio webhooks under
 * /api/voice/twilio; this is for logging calls that happened elsewhere.
 */
export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<CallBody>(req);
  if (!body?.caller) return badRequest("caller is required");

  const call = await db.callLog.create({
    data: {
      caller:       body.caller,
      direction:    body.direction === "outbound" ? "outbound" : "inbound",
      durationSec:  Number(body.durationSec) || 0,
      outcome:      body.outcome || "completed",
      status:       "completed",
      summary:      body.summary,
      recordingUrl: body.recordingUrl,
      userId:       gate.userId,
    },
  });
  return NextResponse.json(call, { status: 201 });
}
