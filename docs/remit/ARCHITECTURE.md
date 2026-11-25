# Money transfer platform — architecture

The customer-facing platform for international money transfer. Ireland → South
Africa (EUR → ZAR) is the first corridor; nothing in the code is specific to it.

---

## 1. The regulatory boundary (read this first)

**This application never holds, transfers or controls customer money.**

That is not a disclaimer, it is the architecture. Every movement of funds
happens behind a provider interface implemented by a regulated institution:

```
Customer  →  [ this application ]  →  PaymentProvider   → regulated PI/EMI collects the funds
                                  →  FXProvider        → regulated FX counterparty
                                  →  PayoutProvider    → licensed payout partner pays the recipient
                                  →  KYCProvider       → regulated identity verification
                                  →  ScreeningProvider → sanctions/PEP data provider
```

The application owns: the customer experience, pricing display, quote
lifecycle, recipient data, the transfer state machine, the compliance workflow,
notifications, the audit trail and reporting. It does not own a balance.

### What you still cannot do without a licence

Building this does not make the business legal to operate. Before a single real
customer:

- Either obtain authorisation as a payment institution / EMI in the sending
  jurisdiction, **or** operate formally as the agent of an authorised firm.
- Have a named compliance officer, a written AML/CFT policy, and a real
  transaction-monitoring and suspicious-activity-reporting process.
- Contract with a licensed payout partner in each destination country.
- Have the legal documents in `/send/legal/*` actually drafted by a lawyer.

The code says "Sandbox" everywhere precisely so that none of this can be
quietly skipped.

---

## 2. Stack

Built into the existing Next.js application rather than as a second app: same
Prisma client, same NextAuth session, same Tailwind build. All remittance code
lives under `src/remit/**`, `src/app/(remit)/**`, `src/app/api/remit/**` and
`src/components/remit/**`, and its tables are prefixed `remit_`, so it can be
lifted into its own service later without renaming anything.

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth (credentials), bcrypt cost 12 |
| Money | Integer minor units in a `Money` value object; decimal.js for rates |
| Styling | Tailwind, scoped theme under `[data-app="send"]` |
| Charts | Recharts |
| Tests | Vitest — unit + integration against a real Postgres |

---

## 3. Module map

```
src/remit/
  config/       brand tokens (renameable), runtime settings
  money/        Money value object, currency metadata
  fx/           market rate vs customer rate vs margin
  fees/         fee engine — rule selection and calculation
  quotes/       pure quote arithmetic and expiry
  transfers/    status enum, state machine, customer timeline
  compliance/   risk scoring (pure)
  corridors/    per-country recipient field schemas + validation
  providers/    interfaces, registry, sandbox impls, Stripe adapter
  server/       Prisma-bound services (quote, transfer, compliance,
                customer, webhook, analytics, audit, auth, rate limit)
  validation/   zod request schemas

src/app/(remit)/send/    landing, auth, customer app, admin, legal
src/app/api/remit/       REST API
src/components/remit/    UI
tests/remit/             unit + integration tests
```

The split that matters: everything in `config/`, `money/`, `fx/`, `fees/`,
`quotes/`, `transfers/`, `compliance/` and `corridors/` is **pure** — no
database, no network. That is what makes the money behaviour exhaustively
testable. `server/` is the only place that touches Prisma.

---

## 4. Money

Amounts are a `bigint` count of minor units plus a currency code. Floating
point is never used for an amount.

```ts
Money.fromDecimalString("300", "EUR")   // 30000n minor
  .add(Money.fromDecimalString("5", "EUR"))
  .convert("19.85", "ZAR")              // rounds DOWN to the cent
```

- Addition/subtraction across currencies throws.
- FX conversion rounds **down**, so a quoted recipient amount is always
  deliverable by the FX actually purchased.
- Percentage fees round half-up.
- Amounts leave the API as `{ currency, minor, amount, formatted }` with `minor`
  as a **string**, so no JSON parser can round-trip them through a float.

---

## 5. Pricing: four separate numbers

| Number | Meaning |
|---|---|
| `marketRate` | mid-market rate from the FX provider |
| `fxMarginBps` | our margin in basis points (0 on IE→ZA today) |
| `customerRate` | `marketRate × (1 − margin)` — what converts the money |
| `fee` | the flat transfer fee, charged separately |

All four are stored on the quote and the transfer and all four are shown to the
customer. Hiding a margin inside "the rate" is the standard trick in this
industry and the whole proposition here is not doing it.

The fee is a **row** in `remit_fee_rules`, resolved at quote time. Exactly one
rule applies — highest priority, then most specific. Fees never stack, so the
number the customer sees is the whole charge. Promotional, business,
high-value and corridor-specific pricing are all additional rows.

The fee is charged **on top of** the send amount: send €300 → recipient's side
is calculated from the full €300, total charged is €305.

---

## 6. Quote lifecycle

```
POST /api/remit/transfers/quote
  → corridor lookup → FX rate → fee rule → calculation → persisted, ACTIVE, TTL 15 min
POST /api/remit/transfers  { quoteId, recipientId, idempotencyKey }
  → quote must be ACTIVE, unexpired, and owned by this customer
  → marked CONSUMED inside the same transaction that creates the transfer
```

A quote is immutable. If it expires, the customer is shown the new price and
asked again — the amount is never silently changed. A consumed quote cannot be
reused, even with a different idempotency key.

---

## 7. Transfer state machine

```
PENDING → PROCESSING → PAYMENT_RECEIVED → [COMPLIANCE_REVIEW] → CONVERTING → SENT → COMPLETED
                                                              ↘ FAILED / CANCELLED
```

- No API route accepts a status from a client. There is no `PUT /status`.
- Every move goes through `transition()`, which validates against the allowed
  transition map and writes an append-only event row **and** an audit row in the
  same database transaction.
- Backwards moves are rejected, which is what stops a replayed or out-of-order
  provider webhook from un-completing a paid transfer.
- Terminal states have no outgoing transitions.
- Cancellation is only possible before the funds are collected.

---

## 8. Compliance

Runs before any payment is requested from the customer. There is no code path
to the payment provider that skips it.

```
assessRisk() → hard stop        → transfer refused, audited
             → REVIEW_REQUIRED  → transfer pauses at COMPLIANCE_REVIEW, no money taken
             → NORMAL           → payment initiated
```

Hard stops: screening match, rejected KYC, breach of the corridor's 24h or 30d
limit. Scored signals: high value, incomplete KYC, velocity, destination country
risk band, new recipient, new account. A single blocking signal or a cumulative
score of 50+ sends it to a human.

An admin with `compliance:review` approves or rejects. Approval resumes the
transfer from wherever it paused; rejection fails it and returns any funds. A
rejection requires a written reason, enforced server-side.

The sandbox screening provider matches a three-name test fixture. It is a test
double, not a sanctions list — real screening needs a licensed data provider.

---

## 9. Security controls

| Control | Where |
|---|---|
| Password hashing | bcrypt cost 12, `customer-service.ts` |
| Session | NextAuth JWT; auth checked in the route-group layout |
| RBAC | `remit_admins` row + explicit permission list, not a user flag |
| Server-side money | No route accepts a fee, rate, recipient amount or total |
| Input validation | zod on every body; `.strict()` on recipient details |
| Idempotency | unique `(customerId, idempotencyKey)` on transfers |
| Webhook auth | signature verified over the **raw** body; unsigned = rejected |
| Webhook replay | unique `(provider, externalId)`; insert-then-process |
| Rate limiting | fixed-window on quote, transfer and auth endpoints |
| Audit | append-only; no update or delete path exists in the codebase |
| Enumeration | wrong password and unknown email give the same message |
| Data minimisation | only the fields the payout network needs are collected |
| Verification codes | only the SHA-256 hash is stored; the notification log keeps a redacted body, never the plaintext code |
| Masking | account numbers masked in API output, logs and admin views |
| No card data | Stripe hosted element; this server never sees a PAN |

Rate limiting is in-process, so it protects a single instance. Behind more than
one instance it must be backed by Redis or an edge limiter — the interface does
not change.

---

## 10. Corridors are data

Adding Ireland → Nigeria needs:

1. a `remit_countries` row (with `canReceive`),
2. a `remit_currencies` row,
3. a `remit_corridors` row with limits, FX margin and provider keys,
4. enabled payment/payout option rows,
5. a recipient field schema in `src/remit/corridors/recipient-schema.ts`,
6. a payout provider implementation for that country.

Steps 1–4 are admin UI. Step 5 is a data structure. Step 6 is the only real
engineering, and it is one interface.

---

## 11. Sandbox and demo mode

Every provider has a sandbox implementation that follows the identical code
path — the transfer engine cannot tell them apart. `REMIT_DEMO_MODE` plus a
transfer's own `isDemo` flag gate the simulator, which advances a sandbox
transfer by calling the *same functions the real webhooks call*.

Sandbox state is surfaced in the UI everywhere it applies: a badge on the
transfer, the quote, the corridor, the customer row and the admin dashboard.
This is a safety control, not decoration.

---

## 12. What is deliberately not built

- **Live provider integrations.** The Stripe pay-in adapter is real and works
  with test keys, and the Resend email adapter is real and works with an API
  key; payout, FX, KYC and screening are sandbox only. Faking these would be
  worse than not having them.
- **A wallet or stored balance.** That is regulated activity.
- **Multi-currency reporting.** Analytics only rolls up EUR-denominated
  transfers; a second sending currency needs a reporting-rate policy, which is a
  decision, not a default.
- Business accounts, recurring transfers, referrals, promo redemption UI,
  mobile apps. The schema and interfaces leave room; the MVP does not include
  them.
