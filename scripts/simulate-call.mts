/**
 * Simulates an inbound call against a locally running development server,
 * without a telephony provider.
 *
 *   VOICE_SKIP_SIGNATURE_CHECK=true npm run dev
 *   npm run simulate:call -- +35315550199 "my boiler has stopped working"
 *
 * It posts to the real webhooks the carrier posts to, so it exercises tenant
 * resolution, the conversation engine, transcript persistence and post-call
 * processing exactly as a real call does. Only the carrier is absent.
 *
 * Requires VOICE_SKIP_SIGNATURE_CHECK=true, which is ignored in production.
 */

const BASE = process.env.SIMULATE_BASE_URL || "http://localhost:3005";
const to = process.argv[2] || "+35315550199";
const script = process.argv.slice(3);
const from = process.env.SIMULATE_FROM || "+353870000999";
const callSid = `SIM${Date.now()}`;

if (script.length === 0) {
  script.push("hi, my boiler has stopped working", "yes it's an emergency", "no that's all, thanks");
}

async function post(path: string, params: Record<string, string>) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  if (response.status === 403) {
    console.error(
      "\nRejected (403). Start the dev server with VOICE_SKIP_SIGNATURE_CHECK=true, " +
        "or the webhook signature cannot be verified without a real carrier.\n"
    );
    process.exit(1);
  }
  return response.text();
}

/**
 * Pulls the spoken line out of TwiML. When there is a <Gather>, only what is
 * inside it is actually said to the caller — the <Say> after it is the
 * "I didn't catch that" fallback, which a real caller only hears in silence.
 */
function spoken(twiml: string): string {
  const gather = twiml.match(/<Gather[^>]*>([\s\S]*?)<\/Gather>/);
  const source = gather ? gather[1] : twiml;
  return [...source.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)]
    .map((match) =>
      match[1]
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    )
    .join(" ");
}

function actionUrl(twiml: string): string | null {
  const match = twiml.match(/action="([^"]+)"/);
  if (!match) return null;
  return match[1].replace(/&amp;/g, "&").replace(BASE, "");
}

async function main() {
  console.log(`\nCalling ${to} from ${from}…\n`);

  let twiml = await post("/api/webhooks/twilio/voice", {
    CallSid: callSid,
    From: from,
    To: to,
    CallStatus: "ringing",
  });

  console.log(`AI:       ${spoken(twiml)}`);

  for (const line of script) {
    const action = actionUrl(twiml);
    if (!action) {
      console.log("\n(The call ended.)");
      break;
    }

    console.log(`CUSTOMER: ${line}`);
    twiml = await post(action, { CallSid: callSid, SpeechResult: line, CallStatus: "in-progress" });
    console.log(`AI:       ${spoken(twiml)}`);

    if (twiml.includes("<Dial>")) {
      console.log("\n(Transferred to a person.)");
      break;
    }
    if (twiml.includes("<Hangup/>") && !twiml.includes("<Gather")) {
      console.log("\n(The AI ended the call.)");
      break;
    }
  }

  await post("/api/webhooks/twilio/status", {
    CallSid: callSid,
    CallStatus: "completed",
    CallDuration: String(30 + script.length * 20),
  });

  console.log(`\nCall finished. Open ${BASE}/app/calls to see the transcript, summary and lead.\n`);
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
