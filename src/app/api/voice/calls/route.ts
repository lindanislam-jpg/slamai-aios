import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const [calls, aggregate] = await Promise.all([
    db.callLog.findMany({
      where: { userId: gate.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.callLog.aggregate({
      where: { userId: gate.userId },
      _count: true,
      _sum: { durationSec: true },
    }),
  ]);

  const booked = await db.callLog.count({
    where: { userId: gate.userId, outcome: "booked" },
  });

  return NextResponse.json({
    calls,
    stats: {
      total:        aggregate._count,
      totalSeconds: aggregate._sum.durationSec || 0,
      booked,
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
 * Records a completed call. A telephony provider (Twilio, Vonage, …) posts here
 * from its own webhook once one is connected; until then it accepts manual entries.
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
      summary:      body.summary,
      recordingUrl: body.recordingUrl,
      userId:       gate.userId,
    },
  });
  return NextResponse.json(call, { status: 201 });
}
