import { db } from "@/lib/db";
import { getVoiceProvider } from "@/lib/voice/providers";
import { finaliseCall } from "@/lib/voice/call-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** After-hours voicemail: attach the recording and treat it as a message. */
export async function POST(req: Request) {
  const provider = getVoiceProvider();
  const params = await provider.verifyWebhook(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const call = await db.voiceCall.findUnique({
    where: { providerCallId: params.CallSid },
    select: { id: true },
  });
  if (!call) return new Response("", { status: 204 });

  await db.voiceCall.update({
    where: { id: call.id },
    data: {
      recordingUrl: params.RecordingUrl ? `${params.RecordingUrl}.mp3` : null,
      outcome: "message_taken",
      durationSec: Number(params.RecordingDuration || 0),
      status: "completed",
      endedAt: new Date(),
    },
  });

  await db.callTurn.create({
    data: {
      callId: call.id,
      role: "system",
      text: "The caller left a voicemail after hours.",
      offsetSec: 0,
    },
  });

  await finaliseCall(call.id).catch((err) => console.error("[voice] recording finalise failed", err));

  return new Response("", { status: 204 });
}
