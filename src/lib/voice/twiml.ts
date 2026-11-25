/**
 * TwiML construction.
 *
 * Pure string work with no server dependencies, so it can be unit tested
 * without a request. Caller speech ends up inside this XML, so everything that
 * comes from outside is escaped.
 */

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SpeechOptions = { voice: string; language: string };

export function say(text: string, opts: SpeechOptions): string {
  return `<Say voice="${escapeXml(opts.voice)}" language="${escapeXml(opts.language)}">${escapeXml(text)}</Say>`;
}

/**
 * Speaks, then listens. `speechTimeout="auto"` lets the carrier decide when the
 * caller has stopped talking, which is far more natural than a fixed pause.
 * The trailing <Say>/<Hangup> is only reached if the caller says nothing.
 */
export function sayAndGather(text: string, opts: SpeechOptions, action: string): string {
  return (
    `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" ` +
    `action="${escapeXml(action)}" method="POST" actionOnEmptyResult="true">` +
    say(text, opts) +
    `</Gather>` +
    say("Sorry, I didn't catch that. Please call back when you're ready. Goodbye.", opts) +
    `<Hangup/>`
  );
}

export function transfer(text: string, opts: SpeechOptions, number: string, fallback?: string | null): string {
  return (
    say(text, opts) +
    `<Dial timeout="25" answerOnBridge="true">${escapeXml(number)}</Dial>` +
    // Reached only when nobody picks up.
    say(
      "Sorry, nobody is free to take your call right now. We have your details and someone will call you back shortly. Goodbye.",
      opts
    ) +
    (fallback ? `<Dial timeout="20">${escapeXml(fallback)}</Dial>` : "") +
    `<Hangup/>`
  );
}

export function hangup(text: string, opts: SpeechOptions): string {
  return say(text, opts) + `<Hangup/>`;
}
