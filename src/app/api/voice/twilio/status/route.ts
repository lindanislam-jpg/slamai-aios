import { db } from "@/lib/db";
import { verifyTwilioRequest } from "@/lib/twilio";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Turn = { role: "assistant" | "user"; text: string };

type Extraction = {
  summary: string;
  outcome: string;
  name: string | null;
  email: string | null;
  company: string | null;
  interest: string | null;
  score: number;
};

const VALID_OUTCOMES = ["qualified", "booked", "transferred", "voicemail", "no-answer", "completed"];

/**
 * Reads the transcript once the call has ended: a short summary for the call
 * log, plus whatever contact details the caller gave, so the call can become
 * a CRM lead rather than just a recording nobody reads.
 */
async function extractFromTranscript(transcript: Turn[]): Promise<Extraction | null> {
  if (!isOpenAIConfigured() || transcript.length === 0) return null;

  const dialogue = transcript
    .map((t) => `${t.role === "user" ? "Caller" : "Agent"}: ${t.text}`)
    .join("\n");

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read phone call transcripts and return JSON only. Use exactly these keys: " +
            "summary (2 sentences max), outcome (one of: qualified, booked, transferred, voicemail, completed), " +
            "name, email, company, interest (what the caller wanted), score (0-100 lead quality). " +
            "Use null for anything the caller did not actually say. Never invent details.",
        },
        { role: "user", content: dialogue },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Extraction>;
    return {
      summary:  typeof parsed.summary === "string" ? parsed.summary : "",
      outcome:  VALID_OUTCOMES.includes(String(parsed.outcome)) ? String(parsed.outcome) : "completed",
      name:     typeof parsed.name     === "string" && parsed.name.trim()     ? parsed.name.trim()     : null,
      email:    typeof parsed.email    === "string" && parsed.email.trim()    ? parsed.email.trim()    : null,
      company:  typeof parsed.company  === "string" && parsed.company.trim()  ? parsed.company.trim()  : null,
      interest: typeof parsed.interest === "string" && parsed.interest.trim() ? parsed.interest.trim() : null,
      score:    Number.isFinite(Number(parsed.score))
        ? Math.max(0, Math.min(100, Math.round(Number(parsed.score))))
        : 0,
    };
  } catch (err) {
    console.error("Transcript extraction failed:", err);
    return null;
  }
}

export async function POST(req: Request) {
  const params = await verifyTwilioRequest(req);
  if (!params) return new Response("Forbidden", { status: 403 });

  const callSid    = params.CallSid;
  const callStatus = params.CallStatus || "completed";
  const duration   = Number(params.CallDuration) || 0;
  const recording  = params.RecordingUrl || undefined;

  const call = await db.callLog.findUnique({ where: { callSid } });
  if (!call) return new Response("", { status: 204 });

  // Only finalise once the call is genuinely over.
  if (!["completed", "busy", "failed", "no-answer", "canceled"].includes(callStatus)) {
    await db.callLog.update({ where: { callSid }, data: { status: callStatus } });
    return new Response("", { status: 204 });
  }

  const transcript: Turn[] = (() => {
    try { return JSON.parse(call.transcript || "[]") as Turn[]; } catch { return []; }
  })();

  const callerSpoke = transcript.some((t) => t.role === "user");
  const extraction = callerSpoke ? await extractFromTranscript(transcript) : null;

  // A transfer decided mid-call shouldn't be overwritten by the summariser.
  const outcome =
    call.outcome === "transferred" ? "transferred"
    : callStatus === "no-answer"   ? "no-answer"
    : !callerSpoke                 ? "voicemail"
    : extraction?.outcome          ?? "completed";

  let contactId = call.contactId;

  // Turn the caller into a CRM lead, if they gave us anything to go on.
  const agent = await db.voiceAgent.findUnique({ where: { userId: call.userId } });
  if (agent?.captureLeads && extraction && (extraction.name || extraction.email)) {
    // Match an existing contact on phone or email before creating a duplicate.
    const existing = await db.contact.findFirst({
      where: {
        userId: call.userId,
        OR: [
          { phone: call.caller },
          ...(extraction.email ? [{ email: extraction.email }] : []),
        ],
      },
    });

    const noteLine = `Call ${new Date().toLocaleString("en-IE")}: ${extraction.summary}`;

    if (existing) {
      contactId = existing.id;
      await db.contact.update({
        where: { id: existing.id },
        data: {
          // Only fill gaps — never overwrite details already on the record.
          name:    existing.name === existing.phone && extraction.name ? extraction.name : existing.name,
          email:   existing.email   ?? extraction.email,
          company: existing.company ?? extraction.company,
          phone:   existing.phone   ?? call.caller,
          score:   Math.max(existing.score, extraction.score),
          notes:   existing.notes ? `${existing.notes}\n\n${noteLine}` : noteLine,
        },
      });
    } else {
      const created = await db.contact.create({
        data: {
          name:    extraction.name || call.caller,
          email:   extraction.email,
          company: extraction.company,
          phone:   call.caller,
          stage:   outcome === "booked" || outcome === "qualified" ? "qualified" : "lead",
          score:   extraction.score,
          tags:    "voice-ai",
          notes:   [extraction.interest && `Interested in: ${extraction.interest}`, noteLine]
                     .filter(Boolean).join("\n\n"),
          userId:  call.userId,
        },
      });
      contactId = created.id;
    }
  }

  await db.callLog.update({
    where: { callSid },
    data: {
      status:       callStatus,
      outcome,
      durationSec:  duration,
      summary:      extraction?.summary || call.summary,
      recordingUrl: recording ?? call.recordingUrl,
      contactId,
    },
  });

  return new Response("", { status: 204 });
}
