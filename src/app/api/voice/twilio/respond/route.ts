import { db } from "@/lib/db";
import { verifyTwilioRequest } from "@/lib/twilio";
import { twiml, say, sayAndGather, escapeXml } from "@/lib/twiml";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Turn = { role: "assistant" | "user"; text: string };

function parseTranscript(raw: string | null): Turn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Turn[]) : [];
  } catch {
    return [];
  }
}

/** Detects the model asking to hand the call to a human. */
const TRANSFER_MARKER = "[TRANSFER]";
/** Detects the model deciding the conversation is finished. */
const HANGUP_MARKER = "[END]";

/**
 * One turn of the conversation: Twilio posts what the caller said, we ask the
 * model for a reply, speak it, and listen again.
 */
export async function POST(req: Request) {
  const params = await verifyTwilioRequest(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const callSid = params.CallSid;
  const speech  = (params.SpeechResult || "").trim();

  const call = await db.callLog.findUnique({ where: { callSid } });
  if (!call) {
    return twiml(say("Sorry, something went wrong on our end. Goodbye.", "Polly.Amy") + "<Hangup/>");
  }

  const agent = await db.voiceAgent.findUnique({ where: { userId: call.userId } });
  if (!agent) {
    return twiml(say("Sorry, this line isn't configured. Goodbye.", "Polly.Amy") + "<Hangup/>");
  }

  const transcript = parseTranscript(call.transcript);

  // Nothing heard — re-prompt once rather than hanging up on a quiet caller.
  if (!speech) {
    return twiml(sayAndGather("Sorry, I didn't catch that. Could you say it again?", agent.voice, "/api/voice/twilio/respond"));
  }

  transcript.push({ role: "user", text: speech });

  // A long call is usually a stuck loop; wrap up rather than run forever.
  if (transcript.filter((t) => t.role === "user").length > agent.maxTurns) {
    const closing = "Thanks for your time. I'll pass this on and someone will follow up with you shortly. Goodbye.";
    transcript.push({ role: "assistant", text: closing });
    await db.callLog.update({
      where: { callSid },
      data:  { transcript: JSON.stringify(transcript), outcome: "completed" },
    });
    return twiml(say(closing, agent.voice) + "<Hangup/>");
  }

  if (!isOpenAIConfigured()) {
    const fallback = "I'm having trouble with my system right now. Someone will call you back shortly. Goodbye.";
    transcript.push({ role: "assistant", text: fallback });
    await db.callLog.update({
      where: { callSid },
      data:  { transcript: JSON.stringify(transcript), outcome: "failed" },
    });
    return twiml(say(fallback, agent.voice) + "<Hangup/>");
  }

  let reply: string;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            `${agent.systemPrompt}\n\n` +
            `You are speaking on a phone call, so your reply is read aloud: keep it under 40 words, ` +
            `use plain spoken language, and never use lists, markdown or emoji.\n` +
            (agent.transferNumber
              ? `If the caller asks for a human, or you cannot help, reply with exactly ${TRANSFER_MARKER} and nothing else.\n`
              : "") +
            `When the caller is done and there is nothing left to help with, end your reply with ${HANGUP_MARKER}.`,
        },
        ...transcript.map((t) => ({
          role: t.role === "user" ? ("user" as const) : ("assistant" as const),
          content: t.text,
        })),
      ],
    });
    reply = completion.choices[0]?.message?.content?.trim() || "Sorry, could you say that again?";
  } catch (err) {
    console.error("Voice agent completion failed:", err);
    const fallback = "Sorry, I'm having trouble hearing you. Someone will follow up shortly. Goodbye.";
    transcript.push({ role: "assistant", text: fallback });
    await db.callLog.update({
      where: { callSid },
      data:  { transcript: JSON.stringify(transcript), outcome: "failed" },
    });
    return twiml(say(fallback, agent.voice) + "<Hangup/>");
  }

  // Hand off to a human.
  if (reply.includes(TRANSFER_MARKER) && agent.transferNumber) {
    const handoff = "Let me put you through to a colleague now. One moment.";
    transcript.push({ role: "assistant", text: handoff });
    await db.callLog.update({
      where: { callSid },
      data:  { transcript: JSON.stringify(transcript), outcome: "transferred" },
    });
    return twiml(
      say(handoff, agent.voice) +
      `<Dial>${escapeXml(agent.transferNumber)}</Dial>`
    );
  }

  const shouldHangUp = reply.includes(HANGUP_MARKER);
  const spoken = reply.replace(HANGUP_MARKER, "").replace(TRANSFER_MARKER, "").trim();

  transcript.push({ role: "assistant", text: spoken });
  await db.callLog.update({
    where: { callSid },
    data:  { transcript: JSON.stringify(transcript) },
  });

  if (shouldHangUp) {
    return twiml(say(spoken, agent.voice) + "<Hangup/>");
  }

  return twiml(sayAndGather(spoken, agent.voice, "/api/voice/twilio/respond"));
}
