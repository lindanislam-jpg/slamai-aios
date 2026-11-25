# Connecting SlamAI Voice to n8n (and anything else)

Every call, lead, booking and transfer can be pushed to an HTTP endpoint the
moment it happens. That is how SlamAI reaches your CRM, your Slack, your Google
Sheet and everything else — through n8n, Zapier, Make, or your own code.

---

## Set it up

**App → Settings → Integrations → Add endpoint.** Give it a name, a public
HTTPS URL, and tick the events you want. Leave every event unticked to receive
all of them.

The signing secret is shown **once**, on creation. Copy it then. If you lose it,
delete the endpoint and create a new one.

Webhooks are available on the Business plan and above.

---

## What arrives

`POST` with `Content-Type: application/json`:

```json
{
  "event": "lead.created",
  "businessId": "clx...",
  "occurredAt": "2026-05-14T09:31:22.004Z",
  "data": {
    "title": "New lead — Sarah Byrne (94/100)",
    "body": "Customer called about an emergency boiler failure...",
    "callId": "clx...",
    "leadId": "clx...",
    "score": 94
  }
}
```

Headers:

| Header | Value |
|---|---|
| `X-SlamAI-Event` | The event key |
| `X-SlamAI-Timestamp` | Unix seconds |
| `X-SlamAI-Signature` | `sha256=<hex>` |

---

## Events

| Event | Fires when |
|---|---|
| `call.started` | A call is answered |
| `call.ended` | A call finishes and has been analysed |
| `call.missed` | Nobody picked up |
| `call.transferred` | The AI handed the call to a person |
| `call.emergency` | The call was classified as urgent |
| `transcript.completed` | The transcript is ready |
| `lead.created` | A lead was captured |
| `lead.high_value` | A lead scored 75 or above |
| `appointment.booked` | Something was booked |
| `appointment.cancelled` | A booking was cancelled |
| `message.taken` | The AI took a message |
| `agent.unanswered` | The AI could not answer a question — worth adding to your knowledge base |

---

## Verifying the signature

**This matters.** Your webhook URL is on the public internet; without
verification anyone who finds it can post fake leads into your CRM.

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`, hex encoded,
prefixed `sha256=`. Reject anything with a timestamp more than five minutes old
— that is what stops a captured request being replayed.

**Node**

```js
const crypto = require("crypto");

function verify(secret, headers, rawBody) {
  const timestamp = Number(headers["x-slamai-timestamp"]);
  const signature = headers["x-slamai-signature"];

  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

**Python**

```python
import hmac, hashlib, time

def verify(secret: str, headers: dict, raw_body: str) -> bool:
    timestamp = int(headers["x-slamai-timestamp"])
    if abs(int(time.time()) - timestamp) > 300:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.{raw_body}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, headers["x-slamai-signature"])
```

Use the **raw** body, before any JSON parsing. Re-serialising changes the bytes
and the signature will not match.

The reference implementation is `src/lib/voice/signing.ts`, and it is covered by
`tests/webhooks.test.ts`.

---

## A worked n8n flow

**Goal:** a hot lead lands in HubSpot, pings Slack and appends to a Google Sheet.

1. **Webhook** node — method `POST`, respond immediately. Copy its production
   URL into SlamAI.
2. **Crypto** node — HMAC SHA256 over `{{$json.headers["x-slamai-timestamp"]}}.{{JSON.stringify($json.body)}}`
   with your secret. (For strict verification use a **Code** node and n8n's raw
   body option — re-serialised JSON can differ byte for byte.)
3. **IF** node — continue only when the computed signature matches
   `{{$json.headers["x-slamai-signature"]}}`.
4. **Switch** node on `{{$json.body.event}}`.
5. On `lead.high_value`:
   - **HubSpot** → Create contact
   - **Slack** → Post to `#new-leads`: `🔥 {{$json.body.data.title}}`
   - **Google Sheets** → Append row

Point SlamAI's endpoint at the n8n webhook URL, tick `lead.created` and
`lead.high_value`, and test it from the dashboard.

---

## Delivery behaviour

- Each delivery has an **8 second** timeout.
- Failures are recorded on the endpoint with the HTTP status and a failure
  count, visible in Settings → Integrations.
- After **20 consecutive failures** the endpoint is paused automatically, rather
  than hammering a dead URL forever. Re-enabling it resets the counter.
- Delivery is **fire and forget**: a slow or broken receiver never delays or
  fails a phone call. That is deliberate — your integration must not be able to
  drop a customer's call.
- There is no automatic retry. If you need guaranteed delivery, have your
  receiver acknowledge quickly and queue the work on your side.

---

## Not using n8n?

Anything that can receive an HTTP POST works: a Zapier "Catch Hook", a Make
custom webhook, a Cloudflare Worker, an AWS Lambda URL, or your own endpoint.
Verify the signature and you are done.
