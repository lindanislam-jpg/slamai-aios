import "server-only";
import { redact } from "./monitor/checks";

/**
 * Outbound email through Microsoft 365 (Microsoft Graph, app-only).
 * Configured only by server environment variables, never in the browser:
 *   M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET — an Entra app registration
 *     with the Mail.Send application permission (admin consented), ideally limited
 *     to the sender mailbox by an Exchange application access policy.
 *   M365_SENDER — the mailbox mail is sent from, e.g. quality@asgardmm.com.
 * Graph answers 202 Accepted: the message was handed to Exchange. That is not
 * proof of delivery, and callers must not report it as such.
 */

export function emailStatus() {
  const missing = ["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET", "M365_SENDER"].filter((k) => !process.env[k]?.trim());
  return { configured: missing.length === 0, missing, sender: process.env.M365_SENDER?.trim() || null };
}

let token: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.M365_TENANT_ID!.trim())}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.M365_CLIENT_ID!.trim(),
      client_secret: process.env.M365_CLIENT_SECRET!.trim(),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Microsoft 365 sign-in failed (${res.status}${body.error ? ` ${body.error}` : ""})`);
  token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

export interface MailResult { accepted: boolean; outcome: string }

/** Sends one plain-text message to the given addresses (as BCC-free individual To list). */
export async function sendMail(to: string[], subject: string, text: string): Promise<MailResult> {
  const st = emailStatus();
  if (!st.configured) return { accepted: false, outcome: "not configured — nothing sent" };
  const recipients = [...new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return { accepted: false, outcome: "no recipients with an email address — nothing sent" };
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(st.sender!)}/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: { subject: subject.slice(0, 250), body: { contentType: "Text", content: text }, toRecipients: recipients.map((address) => ({ emailAddress: { address } })) },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 202) return { accepted: true, outcome: `accepted by Microsoft 365 for ${recipients.length} recipient(s) — delivery not confirmed` };
    const err = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    return { accepted: false, outcome: `rejected by Microsoft 365 (${res.status}${err.error?.code ? ` ${err.error.code}` : ""}) — nothing sent` };
  } catch (e) {
    return { accepted: false, outcome: `failed: ${redact(e instanceof Error ? e.message : String(e))}` };
  }
}
