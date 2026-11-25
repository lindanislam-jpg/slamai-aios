# Connecting a real phone line

SlamAI Voice never talks to a carrier directly. Everything goes through the
`VoiceProvider` interface in `src/lib/voice/providers/types.ts`, with Twilio as
the shipped adapter. Adding another carrier is a new file, not a refactor.

---

## What you need

1. A Twilio account (or another carrier you write an adapter for).
2. A **publicly reachable HTTPS URL** for this app. Twilio has to be able to
   POST to it — `localhost` will not work.

For local development use a tunnel:

```bash
ngrok http 3005
# → https://a1b2c3d4.ngrok-free.app
```

---

## Configure

```bash
VOICE_PROVIDER="twilio"
VOICE_PROVIDER_ACCOUNT_ID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   # Account SID
VOICE_PROVIDER_API_KEY="your_auth_token"                          # Auth Token
VOICE_WEBHOOK_BASE_URL="https://a1b2c3d4.ngrok-free.app"          # tunnel or production URL
NEXT_PUBLIC_APP_URL="https://a1b2c3d4.ngrok-free.app"
```

`VOICE_PROVIDER_API_KEY` is what signs every inbound webhook. **Without it,
every call webhook is rejected.** That is intentional: an unsigned webhook from
the public internet could otherwise make your AI answer a call on behalf of any
tenant.

Restart the app after changing these.

---

## Get a number

**In the dashboard** — Settings → Phone numbers → Connect a number → Buy a new
number. Pick a country, choose a number, done. It is bought, pointed at this
app and assigned to your receptionist in one step.

**A number you already own** — the same dialog, "Use a number I own". If the
number is already on your Twilio account, it is repointed automatically.

**A number with another carrier** — do not port it. Buy a SlamAI number and
forward your advertised number to it. Every carrier supports this and it takes
two minutes. Your customers keep dialling the number on your van.

---

## Point a number at SlamAI by hand

If you would rather configure Twilio directly:

| Setting | Value |
|---|---|
| A call comes in → Webhook | `https://YOUR_URL/api/webhooks/twilio/voice` (HTTP POST) |
| Call status changes → Webhook | `https://YOUR_URL/api/webhooks/twilio/status` (HTTP POST) |

Then add the number in Settings → Phone numbers so SlamAI knows it belongs to
your workspace. `PhoneNumber.e164` is globally unique, which is exactly how an
inbound call resolves to one tenant and one tenant only.

---

## What happens on a call

```
Caller dials your number
  → Twilio POSTs /api/webhooks/twilio/voice
  → signature verified, else 403
  → dialled number resolves the tenant
  → agent active? in hours? within plan minutes?
  → VoiceCall created, greeting spoken, <Gather> listens
        ↓
  Caller speaks
  → Twilio POSTs /api/webhooks/twilio/respond?callId=…
  → knowledge searched, model called with tools
  → tools run: capture_lead, check_availability, book_appointment,
               transfer_call, take_message, end_call
  → reply spoken, listen again  ⟲
        ↓
  Call ends
  → Twilio POSTs /api/webhooks/twilio/status (authoritative duration)
  → transcript analysed → customer → lead + score → usage → notifications
```

Post-call processing is idempotent on the call id, so a retried webhook never
creates a second lead.

---

## Testing without picking up a phone

Settings up a number is not required to try the AI. **App → Test your AI** runs
the *same* engine a real call runs, with persistence turned off. Same prompt,
same knowledge, same tools, same rules. It also shows you which tools ran and
which knowledge passages were quoted, which a real call cannot.

---

## Troubleshooting

**Every call is rejected with 403.**
`VOICE_PROVIDER_API_KEY` is wrong, or the URL Twilio called does not match the
one the signature was computed over. Set `VOICE_WEBHOOK_BASE_URL` to the exact
public origin, including protocol.

**Calls connect but the AI says it cannot take the call.**
`AI_API_KEY` is not set. The agent degrades to an apology and a callback promise
rather than hanging up silently.

**Calls go to "our assistant isn't available".**
The receptionist is switched off, or no receptionist is assigned to that number.
Check App → AI Receptionist and Settings → Phone numbers.

**Calls get forwarded to a person immediately.**
The workspace is out of included minutes for the period. Check App → Billing.
A tenant out of minutes is forwarded rather than cut off.

---

## Writing another adapter

Implement `VoiceProvider` from `src/lib/voice/providers/types.ts`, add a case in
`src/lib/voice/providers/index.ts`, and set `VOICE_PROVIDER` to its name. The
interface covers number search, purchase, configuration, release, call lookup,
recordings and webhook verification. Nothing outside the adapter changes.

Real-time streaming providers fit the same interface: implement `verifyWebhook`
for your event transport and resolve turns from your socket instead of a
`<Gather>` POST. `runTurn` in `src/lib/voice/conversation.ts` is transport
agnostic.
