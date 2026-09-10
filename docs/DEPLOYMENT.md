# Deploying SlamAI Voice

Vercel plus a managed Postgres is the shortest path, and it is what the app is
built for. Anything that runs a Next.js 15 standalone build works.

---

## 1. Database

Use a managed Postgres with automated backups and point-in-time recovery. Neon,
Supabase and RDS all qualify.

Set both:

```
DATABASE_URL   # pooled connection, used at runtime
DIRECT_URL     # direct connection, used for migrations
```

On a host that does not separate them, set both to the same value.

Apply the schema before the new code serves traffic:

```bash
npx prisma migrate deploy
```

---

## 2. Deploy

```bash
vercel --prod
```

Or connect the repository in the Vercel dashboard. `npm run build` already runs
`prisma generate`, so the client is always built against the current schema.

**Node runtime.** Every route that verifies a signature, parses a document or
talks to Prisma declares `runtime = "nodejs"`. Do not move them to the edge —
they use Node crypto and the Prisma client.

**Timeouts.** The call turn, knowledge indexing and post-call analysis routes
declare `maxDuration = 60`. On Vercel Hobby the ceiling is lower; a long call
turn can be cut off mid-sentence. **Use a paid plan for production.**

---

## 3. Environment

Set everything from `.env.example` in your host's environment settings. The
minimum for a working production deployment:

```
DATABASE_URL, DIRECT_URL
NEXTAUTH_SECRET            openssl rand -base64 32 — a fresh one, not the dev value
NEXTAUTH_URL               https://yourdomain.com
NEXT_PUBLIC_APP_URL        https://yourdomain.com
AI_API_KEY                 or the AI cannot answer calls
VOICE_PROVIDER_ACCOUNT_ID  or no real calls arrive
VOICE_PROVIDER_API_KEY
STRIPE_SECRET_KEY          or nobody can pay you
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_VOICE_*       one per plan you sell
RESEND_API_KEY             or notifications are recorded as skipped
```

Make sure `VOICE_SKIP_SIGNATURE_CHECK` is **not** set. It is ignored in
production anyway, but leaving it in your config is a trap for the next person.

---

## 4. Point the providers at production

**Telephony** — Settings → Phone numbers rewires your numbers automatically when
you connect them. If you configured a number by hand, update its voice webhook
to `https://yourdomain.com/api/webhooks/twilio/voice`.

**Stripe** — add the production endpoint
`https://yourdomain.com/api/webhooks/stripe` and subscribe to the events listed
in [STRIPE_SETUP.md](./STRIPE_SETUP.md). Copy the new signing secret; it differs
from the CLI one.

---

## 5. Make yourself a platform admin

```bash
psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'admin' WHERE email = 'you@yourdomain.com';"
```

---

## 6. Verify, don't assume

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/voice     # 200
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/app       # 307 to sign-in

# An unsigned call webhook must be refused.
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://yourdomain.com/api/webhooks/twilio/voice                        # 403
```

Then, from the product:

- Sign up a fresh workspace and finish onboarding.
- Add a knowledge source and check it reaches "Ready".
- Use **Test your AI** and confirm it quotes your knowledge and refuses to
  invent a price.
- Connect a number and ring it from your own phone.
- Check the call appears with a transcript, a summary and a lead score.

---

## 7. Scheduled work

Two jobs are not automated, deliberately, because both destroy or bill customer
data and you should own the policy:

**Retention** — delete calls past each plan's `retentionDays`. See
[DATABASE.md](./DATABASE.md).

**Overage billing** — report `overageMinutes` from `getUsageSummary()` to a
Stripe metered price at period end. See [STRIPE_SETUP.md](./STRIPE_SETUP.md).

Run either as a Vercel Cron, a GitHub Action, or whatever your host provides.

---

## 8. What to watch

| Signal | Where | Why it matters |
|---|---|---|
| Failed webhook deliveries | Admin → Overview | A customer's CRM has stopped receiving leads |
| Failed notifications | Admin → Overview | Owners are not being told about leads |
| `past_due` subscriptions | Admin → Workspaces | Revenue at risk |
| Voice minutes vs plan | Admin → Overview | Cost and overage exposure |
| 500s from `/api/webhooks/twilio/respond` | Your logs | Calls are failing mid-conversation |

`[api:*]`, `[voice]`, `[webhooks]` and `[notifications]` prefixes make these easy
to filter in any log aggregator.

---

## Self-hosting

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start          # binds port 3005
```

Put it behind a TLS terminator, set the same environment variables, and make
sure the public origin matches `NEXT_PUBLIC_APP_URL` exactly — the telephony
signature is computed over the URL the provider actually called.
