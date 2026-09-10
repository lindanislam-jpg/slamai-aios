import { db } from "@/lib/db";
import { getVoiceProvider } from "@/lib/voice/providers";
import { finaliseCall } from "@/lib/voice/call-flow";
import { notify } from "@/lib/voice/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The carrier's end-of-call callback. This is the authoritative duration, and
 * the safety net that finalises a call the caller hung up on mid-sentence.
 */
export async function POST(req: Request) {
  const provider = getVoiceProvider();
  const params = await provider.verifyWebhook(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const providerCallId = params.CallSid;
  const status = params.CallStatus ?? "completed";
  const durationSec = Number(params.CallDuration || 0);

  const call = await db.voiceCall.findUnique({
    where: { providerCallId },
    select: { id: true, businessId: true, fromNumber: true, status: true, summary: true },
  });
  if (!call) return new Response("", { status: 204 });

  const finished = ["completed", "busy", "failed", "no-answer", "canceled"].includes(status);
  if (!finished) return new Response("", { status: 204 });

  const missed = status === "no-answer" || status === "busy" || status === "canceled";

  await db.voiceCall.update({
    where: { id: call.id },
    data: {
      status: missed ? "no_answer" : status === "failed" ? "failed" : "completed",
      endedAt: new Date(),
      // Trust the carrier's duration over our own elapsed estimate.
      ...(durationSec > 0 && { durationSec }),
      ...(missed && { outcome: "missed", aiHandled: false }),
    },
  });

  if (missed) {
    void notify({
      businessId: call.businessId,
      event: "call.missed",
      title: `Missed call from ${call.fromNumber}`,
      body: "Nobody answered this call.",
      data: { callId: call.id, from: call.fromNumber },
    });
    return new Response("", { status: 204 });
  }

  // finaliseCall is idempotent, so a duplicate callback is harmless.
  await finaliseCall(call.id).catch((err) => console.error("[voice] status finalise failed", err));

  return new Response("", { status: 204 });
}
