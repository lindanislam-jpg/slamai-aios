# Billing with Stripe

Prices live in Stripe. This codebase stores a **plan id** and Stripe's own
identifiers — never a price. That means changing what you charge is a change in
Stripe plus one environment variable, not a code change.

---

## 1. Create the products

In the Stripe dashboard, create one recurring monthly price per plan:

| Plan | Price | Environment variable |
|---|---|---|
| Starter | €99/month | `STRIPE_PRICE_VOICE_STARTER` |
| Business | €249/month | `STRIPE_PRICE_VOICE_BUSINESS` |
| Pro | €499/month | `STRIPE_PRICE_VOICE_PRO` |
| Enterprise | negotiated | `STRIPE_PRICE_VOICE_ENTERPRISE` |

Copy each price ID (`price_...`) into the matching variable.

A plan with no price ID configured **cannot be bought**, and the billing page
says so rather than opening a checkout that would fail.

The plan's limits, features and overage rate live in
`src/lib/voice/plans.ts`. That file is the single source of truth for the
marketing site, the pricing page, the billing page and every server-side limit
check. Change a limit there, nowhere else.

---

## 2. Keys

```bash
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 3. The webhook

Stripe must be able to reach `POST /api/webhooks/stripe`.

**Locally:**

```bash
stripe listen --forward-to localhost:3005/api/webhooks/stripe
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.

**In production**, add the endpoint in the Stripe dashboard and subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

The handler verifies the signature against the **raw** request body before
reading anything. An unverified webhook could otherwise upgrade any workspace
for free, so an unsigned request is refused outright.

---

## 4. How a tenant is identified

The workspace id travels on the Stripe customer's metadata *and* on the
subscription's metadata, and `Subscription.stripeCustomerId` is unique in our
database. Whichever event fires, the handler can resolve the right workspace —
it does not depend on a single event carrying the right field.

---

## 5. Upgrades, downgrades and cancellation

All handled by Stripe's own billing portal, opened from App → Billing → Manage
billing. Invoices, payment methods and billing history live there too. We do not
reimplement any of it.

When the portal changes a subscription, Stripe fires
`customer.subscription.updated` and the plan changes here within seconds.

---

## 6. Usage and overage

Every billable action writes a `UsageEvent` row: voice minutes, calls, AI
tokens, knowledge searches, SMS, appointments and transfers. The usage page
aggregates them per billing period.

Overage is **reported as an estimate** — included minutes against used minutes
at the plan's per-minute rate. It is not metered to Stripe automatically. If you
want to bill overage:

1. Create a metered price in Stripe.
2. At the end of each period, read `getUsageSummary()` from
   `src/lib/voice/usage.ts` and report `overageMinutes` as a usage record.

That step is deliberately not automated — you should decide your overage policy
before you start charging for it.

---

## 7. What happens when a payment fails

`invoice.payment_failed` sets the subscription to `past_due`. The billing page
shows a clear banner asking the owner to update their card. The AI keeps
answering — cutting off a customer's phone line over one failed card is a good
way to lose them permanently. Suspending a workspace is a deliberate manual
action in the admin panel.

---

## 8. Testing

Use Stripe's test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0341`
fails after attaching. Check that:

- Checkout returns to `/app/billing?checkout=success`
- The plan changes within a few seconds of the webhook firing
- `Subscription.status` becomes `active`
- Plan limits take effect (try adding more receptionists than your plan allows)
