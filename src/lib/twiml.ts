// Building TwiML is pure string work with no server dependencies, so it lives
// apart from the request-verification code and can be tested on its own.

/** Wraps TwiML in a Response with the content type Twilio expects. */
export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/** Escapes text before it goes into TwiML — caller speech ends up in this XML. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A <Say> using the agent's configured voice. */
export function say(text: string, voice: string): string {
  return `<Say voice="${escapeXml(voice)}">${escapeXml(text)}</Say>`;
}

/**
 * Speaks a line, then listens for the caller's reply and posts it to `action`.
 * `speechTimeout="auto"` lets Twilio decide when the caller has stopped talking.
 */
export function sayAndGather(text: string, voice: string, action: string): string {
  return (
    `<Gather input="speech" speechTimeout="auto" action="${escapeXml(action)}" method="POST">` +
    say(text, voice) +
    `</Gather>` +
    // Reached only if the caller says nothing at all.
    say("Sorry, I didn't catch that. Goodbye for now.", voice) +
    `<Hangup/>`
  );
}
