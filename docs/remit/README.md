# Money transfer MVP — running it

Sandbox build. **No real money can move**: every provider is a sandbox
implementation and nothing is connected to a regulated institution.

## Setup

```bash
npm install
cp .env.example .env.local          # fill in DATABASE_URL and NEXTAUTH_SECRET
npm run db:push                     # create the schema
npm run db:seed:remit               # reference data, corridor, €5 fee, demo accounts
npm run dev                         # http://localhost:3005/send
```

The seed prints the admin and demo credentials it created.

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

97 tests. Unit tests cover money arithmetic, the fee engine, FX pricing, quote
calculation and expiry, the state machine, the customer timeline, risk scoring,
recipient validation, webhook signature verification and rate limiting.

Integration tests run against a real Postgres and cover the full transfer
journey, quote consumption, concurrent duplicate submission, compliance
approval and rejection, screening blocks, cancellation rules, notifications,
the audit trail and gross-margin arithmetic.

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
