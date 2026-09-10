import { db } from "@/lib/db";
import { getVoiceProvider, appBaseUrl } from "@/lib/voice/providers";
import { twiml, sayAndGather, hangup, transfer } from "@/lib/voice/twiml";
import { loadCallContext, runTurn, type Turn, type CapturedDetails } from "@/lib/voice/conversation";
import { finaliseCall } from "@/lib/voice/call-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A model round trip plus a knowledge search needs more than the default.
export const maxDuration = 60;

/**
 * One turn of a live call: the caller said something, the agent replies.
 *
 * The callId travels in the action URL rather than being looked up from the
 * provider's call id on every turn, which saves a query per turn — but the
 * record is still re-read and scoped, so a forged id cannot reach another
 * tenant's call.
 */
export async function POST(req: Request) {
  const provider = getVoiceProvider();
  const params = await provider.verifyWebhook(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const callId = new URL(req.url).searchParams.get("callId") ?? "";
  const spoken = (params.SpeechResult || "").trim();

  const call = await db.voiceCall.findFirst({
    where: { id: callId, providerCallId: params.CallSid },
    include: { turns: { orderBy: { offsetSec: "asc" } } },
  });

  const fallback = { voice: "Polly.Amy-Neural", language: "en-GB" };

  if (!call) {
    return twiml(hangup("Sorry, something went wrong on our end. Please call back. Goodbye.", fallback));
  }

  let ctx;
  try {
    ctx = await loadCallContext(call.businessId, call.agentId);
  } catch {
    return twiml(hangup("Sorry, this line isn't set up correctly. Goodbye.", fallback));
  }

  const speech = { voice: ctx.agent.voice, language: ctx.agent.language };
  const action = `${appBaseUrl()}/api/webhooks/twilio/respond?callId=${call.id}`;
  const elapsed = Math.max(0, Math.round((Date.now() - call.startedAt.getTime()) / 1000));

  // Nothing heard — re-prompt once rather than hanging up on a quiet caller.
  if (!spoken) {
    const silentTurns = call.turns.filter((t) => t.role === "system" && t.text === "[no speech]").length;
    if (silentTurns >= 2) {
      await closeCall(call.id, "Caller went quiet.", elapsed);
      return twiml(hangup("I couldn't hear anything, so I'll let you go. Please call back. Goodbye.", speech));
    }
    await db.callTurn.create({
      data: { callId: call.id, role: "system", text: "[no speech]", offsetSec: elapsed },
    });
    return twiml(sayAndGather("Sorry, I didn't catch that. Could you say it again?", speech, action));
  }

  await db.callTurn.create({
    data: { callId: call.id, role: "caller", text: spoken, offsetSec: elapsed },
  });

  const history: Turn[] = call.turns
    .filter((t) => t.role === "caller" || t.role === "agent")
    .map((t) => ({ role: t.role as "caller" | "agent", text: t.text }));

  // A long call is almost always a loop the agent cannot break out of.
  const callerTurns = history.filter((t) => t.role === "caller").length + 1;
  if (callerTurns > ctx.agent.maxTurns) {
    const closing =
      "Thanks for your time. I'll pass this on and someone will follow up with you shortly. Goodbye.";
    await db.callTurn.create({
      data: { callId: call.id, role: "agent", text: closing, offsetSec: elapsed },
    });
    await closeCall(call.id, null, elapsed);
    return twiml(hangup(closing, speech));
  }

  let result;
  try {
    result = await runTurn({
      ctx,
      history,
      callerSaid: spoken,
      persist: true,
      callId: call.id,
      callerPhone: call.fromNumber,
    });
  } catch (err) {
    console.error("[voice] turn failed", err);
    const apology =
      "I'm sorry, I'm having trouble right now. Someone will call you back shortly. Goodbye.";
    await db.callTurn.create({
      data: { callId: call.id, role: "agent", text: apology, offsetSec: elapsed },
    });
    await closeCall(call.id, "The assistant hit an error during the call.", elapsed, "failed");
    return twiml(hangup(apology, speech));
  }

  await db.callTurn.create({
    data: {
      callId: call.id,
      role: "agent",
      text: result.reply,
      offsetSec: Math.max(0, Math.round((Date.now() - call.startedAt.getTime()) / 1000)),
      citations: result.knowledgeUsed.length ? JSON.stringify(result.knowledgeUsed.map((k) => k.id)) : null,
    },
  });

  if (result.action.type === "transfer" && result.action.number) {
    await db.voiceCall.update({
      where: { id: call.id },
      data: { transferred: true, outcome: "transferred", aiHandled: false },
    });
    // Finalise now: once the call is bridged to a person we may not get a
    // clean end-of-call event for the AI portion.
    void finaliseCall(call.id, { captured: result.captured }).catch((err) =>
      console.error("[voice] finalise after transfer failed", err)
    );
    return twiml(transfer(result.reply, speech, result.action.number, ctx.agent.fallbackNumber));
  }

  if (result.action.type === "hangup") {
    await closeCall(call.id, null, elapsed, "completed", result.captured);
    return twiml(hangup(result.reply, speech));
  }

  return twiml(sayAndGather(result.reply, speech, action));
}

/** Marks the call finished and kicks off post-call processing. */
async function closeCall(
  callId: string,
  systemNote: string | null,
  elapsed: number,
  status = "completed",
  captured?: CapturedDetails
) {
  if (systemNote) {
    await db.callTurn
      .create({ data: { callId, role: "system", text: systemNote, offsetSec: elapsed } })
      .catch(() => undefined);
  }
  await db.voiceCall.update({
    where: { id: callId },
    data: { status, endedAt: new Date(), durationSec: elapsed },
  });
  // Awaited so the work is done before the serverless invocation is frozen.
  await finaliseCall(callId, { captured }).catch((err) =>
    console.error("[voice] finalise failed", err)
  );
}
