# Money transfer MVP — running it

Sandbox build. **No real money can move**: every provider is a sandbox
implementation and nothing is connected to a regulated institution.

## Setup

```bash
npm install
cp .env.example .env                # fill in DATABASE_URL and NEXTAUTH_SECRET
npm run setup:remit                 # schema + reference data + a report of what is missing
npm run dev                         # http://localhost:3005/send
```

`setup:remit` pushes the schema, seeds the corridor / €5 fee rule / demo
accounts, verifies the result and prints anything still missing. It is
idempotent, so re-running it is safe. The seed prints the admin and demo
credentials it created.

Sign in with those seeded accounts — **your GitHub or hosting login is not an
account in this app**. It has its own user table, and a fresh database contains
only what the seed creates.

## The demo journey

1. Open `/send` — the landing page calculator prices a transfer live (the
   arithmetic runs on the server, not in the browser).
2. `/send/login` → sign in as the demo customer.
3. `/send/new` → enter €300. You see: €5 fee, the exchange rate, the exact ZAR
   the recipient gets, and the €305 total.
4. Pick the seeded recipient → **Review transfer**.
5. The review screen locks the price with a countdown. Confirm.
6. The tracking screen walks the real state machine to COMPLETED, driven by the
   sandbox simulator standing in for provider webhooks.

Everything sandbox is badged as sandbox.

## Registering a new account

`/send/register` → verify email → verify identity → send. Outside production the
email code is returned by the register endpoint and pre-filled, so the flow
completes without an email provider. In production that never happens.

## Admin

Sign in as the seeded admin, then `/send/admin`:

| Page | What it does |
|---|---|
| Overview | KPIs, volume/revenue charts, corridor and provider performance, integration status |
| Transfers | Search and filter; drill into one for its full event log and raw provider responses |
| Reviews | Approve or reject transfers held by compliance |
| Customers | Search, inspect, suspend or reinstate |
| Fees | Create and toggle fee rules — this is where the €5 lives |
| Corridors | Limits, FX margin, availability |
| Audit log | Read-only view of the append-only trail |

Admin access is a `remit_admins` row with an explicit permission list, not a
flag on the user, and each page checks the specific permission it needs.

## Tests

```bash
npm test
```

115 tests. Unit tests cover money arithmetic, the fee engine, FX pricing, quote
calculation and expiry, the state machine, the customer timeline, risk scoring,
recipient validation, webhook signature verification, rate limiting, the
deployment preflight checks and the Resend payload.

Integration tests run against a real Postgres and cover the full transfer
journey, quote consumption, concurrent duplicate submission, compliance
approval and rejection, screening blocks, cancellation rules, notifications,
the audit trail, gross-margin arithmetic, and email verification including code
supersession, attempt limits and expiry.

## Deploying

Set these in your hosting environment. On Vercel they are **per-environment** —
a preview deployment needs them ticked for **Preview**, not just Production, and
environment variables are never applied to a build that already exists, so
redeploy after adding them.

| Variable | Why |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection |
| `NEXTAUTH_SECRET` | Signs the session cookie. Without it NextAuth refuses to start and **every sign-in fails before the password is checked** — the symptom is an opaque "Server error" page. Generate with `openssl rand -base64 32`. |
| `REMIT_DEMO_MODE` | `true` to enable the sandbox simulator |

Then point `DATABASE_URL` at that database and run setup against it — without
this the app has no corridors, no fee rule and no accounts, so it renders empty
even once auth works:

```bash
DATABASE_URL="postgresql://..." npm run setup:remit
```

It pushes the schema, seeds reference data, verifies the result and prints what
is still missing. Idempotent — safe to re-run. It also labels whether each value
came from your shell or a local `.env`, because a secret in your `.env` says
nothing about whether your deployment has one.

#### Or run it from GitHub instead

If you would rather not run anything locally, the **Set up money-transfer
database** workflow does the same thing on a runner:

1. Add your connection string as a repository secret named
   `REMIT_DATABASE_URL` (Settings → Secrets and variables → Actions). Put it
   there, not in a chat, an issue or a commit.
2. Actions → *Set up money-transfer database* → **Run workflow**.

It is manual-dispatch only. Seeding touches a real database, so running it on
every push would make an accidental force-push a database event.

The workflow cannot set your deployment's environment variables — no CI job
can. It finishes by listing what is still required.

### Checking a deployment

`GET /api/remit/health` reports every required check as JSON and returns **503**
while anything required is missing. It never reports a value, only a status, so
it is safe to leave reachable.

`/send/setup` is the same report as a page. A misconfigured deployment redirects
there from `/send` and `/send/login` instead of failing with a blank error.

### Email delivery

By default the sandbox notification provider records emails without sending
them. That is fine for a local demo — the seeded demo account is already
verified, and outside production the verification code is handed back and
pre-filled.

On a deployed URL, **new sign-ups cannot verify their email without a real
provider**. To send real email:

```
REMIT_NOTIFICATION_PROVIDER="resend"
RESEND_API_KEY="re_..."
REMIT_EMAIL_FROM="Kora Send <no-reply@yourdomain.com>"
```

The sending domain must be verified in your Resend account. Without the key the
registry falls back to sandbox and the health endpoint says email is not
connected.

## Environment variables

Everything secret comes from the environment. Nothing secret is prefixed
`NEXT_PUBLIC_`. See `.env.example` for the full list; the remittance-specific
ones are:

| Variable | Purpose |
|---|---|
| `REMIT_DEMO_MODE` | Enables the sandbox simulator. Off by default in production. |
| `REMIT_QUOTE_TTL_SECONDS` | How long a quote is honoured (default 900). |
| `REMIT_PAYMENT_PROVIDER` etc. | Which provider implementation to use. Defaults to `sandbox`. |
| `REMIT_REVIEW_THRESHOLD_MINOR` | Amount at or above which a transfer is reviewed. |
| `REMIT_PAYOUT_WEBHOOK_SECRET` | HMAC secret for payout webhooks. Without it, webhooks are rejected. |
| `NEXT_PUBLIC_REMIT_BRAND_NAME` | The product name. Change it and the whole product rebrands. |

## Rebranding

The company name is not hardcoded anywhere. Set `NEXT_PUBLIC_REMIT_BRAND_NAME`,
`NEXT_PUBLIC_REMIT_BRAND_SUFFIX`, `NEXT_PUBLIC_REMIT_TAGLINE` and
`NEXT_PUBLIC_REMIT_REFERENCE_PREFIX`; the palette is five values in
`tailwind.config.ts` under `colors.send`.

## Further reading

- `ARCHITECTURE.md` — the regulatory boundary, module map, state machine, security controls
- `BUSINESS-MODEL.md` — whether €5 flat actually works as a business
