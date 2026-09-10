# Troubleshooting

---

## Setup

**`Environment variable not found: DATABASE_URL`**
Prisma reads `.env`, Next reads `.env.local`. Create both:
`cp .env.example .env.local && cp .env.local .env`.

**`Can't reach database server`**
Postgres is not running, or the URL is wrong. Test it directly:
`psql "$DATABASE_URL" -c 'select 1'`.

**The build fails on `@prisma/client`**
Run `npm run db:generate`. It runs automatically as part of `npm run build`.

---

## Signing in

**Signing in does nothing and returns to the form**
`NEXTAUTH_SECRET` is unset or changed. Set it and sign in again — an old cookie
signed with a different secret is silently rejected.

**Signed in but redirected to "Set up a workspace"**
The account has a login but no `Membership`. That happens for accounts created
in the original AIOS app. Create a workspace on that page — it takes one field.

**"That email and password don't match an account"**
Deliberately vague. It means either was wrong; naming which would tell an
attacker which emails have accounts.

---

## Calls

**Every call webhook returns 403**
The signature did not verify. In order of likelihood:

1. `VOICE_PROVIDER_API_KEY` is not your provider's auth token.
2. The URL the provider called differs from the one the app reconstructs.
   Set `VOICE_WEBHOOK_BASE_URL` to the exact public origin, including protocol.
3. You are behind a proxy that rewrites the host. Same fix.

For local tunnels only, `VOICE_SKIP_SIGNATURE_CHECK="true"` bypasses it. It is
ignored when `NODE_ENV=production`.

**Callers hear "our assistant isn't available right now"**
The receptionist is switched off, or no receptionist is assigned to that number.
Check App → AI Receptionist and Settings → Phone numbers.

**Callers hear "I can't take this call properly right now"**
`AI_API_KEY` is not set, or the provider rejected the request. Check your server
logs for `[voice] turn failed`.

**Calls are forwarded to a person immediately**
The workspace is out of included minutes. Check App → Billing. A tenant out of
minutes is forwarded rather than cut off, so nobody loses a customer over it.

**The AI cuts off mid-conversation**
Your host's function timeout is shorter than a model round trip. The call turn
route declares `maxDuration = 60`; on Vercel Hobby the ceiling is lower. Use a
paid plan.

**No transcript after a call**
The status webhook did not arrive. Check the number's `statusCallback` in your
provider — it should be `/api/webhooks/twilio/status`. The call still finalises
from the conversation route, so a summary usually appears anyway.

---

## The AI's answers

**It invented a price**
It should not, and there are two likely causes:

1. A price is in a knowledge source you uploaded, and it quoted that. Remove it
   from the source, or make it accurate.
2. Your custom instructions told it to. Instructions cannot override the safety
   rules, but they can add wrong facts. Check App → AI Receptionist.

Prices come from Settings → Services. Leave a price blank for anything you quote
on site and it will offer a callback instead.

**It doesn't know something obvious**
Check App → Knowledge. The source must show **Ready** with a passage count above
zero. If it shows Failed, the URL was unreachable or the file had no readable
text. Use the test console — it shows exactly which passages were quoted.

**It answers from the wrong page**
Add a more specific source. Knowledge search is per passage, so a focused
"Pricing and fees" source beats a whole-site dump.

**Without an AI key, search still returns something**
That is the keyword fallback. It works, but embeddings are much better — set
`AI_API_KEY` and refresh each source.

---

## Bookings

**"Something else is already booked at that time"**
Correct behaviour. Overlap is checked before every write, by the AI and by the
dashboard alike.

**The AI offers times you are closed**
Check Settings → Opening hours, and check the workspace timezone in
Settings → Business. Hours are wall-clock times in that timezone.

**Bookings appear at the wrong time**
Almost always the timezone. Everything is stored in UTC and rendered in the
workspace's timezone. Set it correctly and existing bookings will render
correctly too.

---

## Notifications

**Emails never arrive**
Check Settings → Notifications → Recently sent. Status `skipped` means no email
provider is configured — set `RESEND_API_KEY`. Status `failed` shows the
provider's error. Nothing is ever reported as sent when it was not.

**Webhooks stopped firing**
Check Settings → Integrations. After 20 consecutive failures an endpoint is
paused automatically rather than hammering a dead URL. Fix the receiver and
re-enable it.

**The receiver rejects our signature**
Verify against the **raw** body, before JSON parsing. Re-serialising changes the
bytes. See [N8N_INTEGRATION.md](./N8N_INTEGRATION.md).

---

## Billing

**"Billing isn't configured yet"**
`STRIPE_SECRET_KEY` is unset.

**A plan says "Contact us" instead of a price**
No Stripe price ID is configured for it. Set `STRIPE_PRICE_VOICE_*`. Better than
opening a checkout that would fail.

**Checkout completes but the plan does not change**
The webhook is not reaching you, or the signing secret is wrong. Locally, run
`stripe listen --forward-to localhost:3005/api/webhooks/stripe` and use the
`whsec_` it prints. In production the dashboard secret is different from the CLI
one.

---

## Admin

**`/app/admin` returns 404**
That is the gate working. Set the role in the database and sign out and back in:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'you@example.com';
```

---

## Tests

**`npm run test:e2e` fails to connect**
It needs a running server: `npm run build && npm run start` in another terminal.
Override the target with `E2E_BASE_URL`.

**Unit tests fail with "This module cannot be imported from a Client Component"**
A test imported a `server-only` module. Pure logic that needs testing belongs in
a module without that import — `signing.ts` and `metrics.ts` exist for exactly
this reason.

---

## Still stuck

Server logs are prefixed by area: `[api:*]`, `[voice]`, `[webhooks]`,
`[notifications]`, `[retrieval]`, `[usage]`, `[audit]`, `[twilio]`, `[stripe]`.
Filter on the one you are debugging.
