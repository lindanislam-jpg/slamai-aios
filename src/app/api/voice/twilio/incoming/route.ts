import { db } from "@/lib/db";
import { verifyTwilioRequest } from "@/lib/twilio";
import { twiml, say, sayAndGather } from "@/lib/twiml";

// Twilio posts form-encoded bodies and needs the raw request; never cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The entry point for an inbound call. Twilio calls this when someone dials a
 * number configured with this URL as its Voice webhook.
 *
 * Routing: the dialled number (`To`) identifies which account owns the call.
 */
export async function POST(req: Request) {
  const params = await verifyTwilioRequest(req);
  if (!params) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid;
  const from    = params.From || "Unknown";
  const to      = params.To   || "";

  const agent = await db.voiceAgent.findUnique({
    where: { phoneNumber: to },
    include: { user: { select: { id: true } } },
  });

  if (!agent || !agent.isActive) {
    // No agent owns this number, or it's switched off — say so rather than
    // dropping the caller into silence.
    return twiml(
      say("Thanks for calling. Our assistant isn't available right now. Please try again later.", "Polly.Amy") +
      "<Hangup/>"
    );
  }

  // Record the call up front so later turns and the status callback can find it.
  await db.callLog.upsert({
    where:  { callSid },
    update: { status: "in-progress" },
    create: {
      callSid,
      caller:     from,
      direction:  "inbound",
      status:     "in-progress",
      outcome:    "in-progress",
      transcript: JSON.stringify([{ role: "assistant", text: agent.greeting }]),
      userId:     agent.userId,
    },
  });

  return twiml(sayAndGather(agent.greeting, agent.voice, "/api/voice/twilio/respond"));
}
