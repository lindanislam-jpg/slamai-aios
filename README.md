# SlamAI

This repository contains two products that share one Next.js application, one
database and one authentication system.

| Product | Where | What it is |
|---|---|---|
| **SlamAI Voice** | `/voice`, `/app` | A multi-tenant AI receptionist SaaS. This is the commercial product. |
| SlamAI AIOS | `/`, `/dashboard`, `/life` | The original single-user AI business suite and Life OS. Untouched. |

---

# SlamAI Voice

**Your AI Receptionist. 24/7. Never Miss a Customer.**

SlamAI Voice answers your calls, talks to customers, captures leads, books
appointments and keeps your business running around the clock.

It is built for businesses whose phone is their front door: plumbers,
electricians, roofers, dentists, salons, estate agents, garages, clinics and
anyone else who loses money every time a call rings out.

---

## What it actually does on a call

```
Caller dials your number
  → greeting
  → understands why they're ringing
  → answers from your knowledge base, or collects what it needs
  → decides whether this is a lead, and qualifies it
  → offers real appointment times and books one
  → transfers to a person if your rules say so
  → confirms the next step and ends the call
  → writes a summary, a scored lead and a full transcript
  → updates your analytics and notifies you
```

Every step is real. The conversation engine that runs a live call is the same
one the in-dashboard test console runs — there is no separate demo path that
could drift out of sync with production.

---

## What it will not do

These are enforced in the prompt **above** anything a business owner writes, so
an instruction cannot override them:

- It never claims to be a person. Asked directly, it says it is an AI assistant.
- It never invents a price, a policy or an availability. Prices come from your
  service list; anything you price on site gets a callback offer instead.
- It never gives medical, legal or financial advice.
- In a genuine emergency it tells the caller to ring the emergency services.

---

## Getting started

```bash
npm install
cp .env.example .env.local && cp .env.local .env
# fill in DATABASE_URL, DIRECT_URL and NEXTAUTH_SECRET

npm run db:push
npm run db:seed:voice     # a populated ABC Plumbing demo — 267 calls
npm run dev
```

Then open http://localhost:3005/voice.

Full instructions, including what each missing API key costs you, are in
[docs/SETUP.md](./docs/SETUP.md).

---

## Architecture

**Stack.** Next.js 15 (App Router), React 19, TypeScript in strict mode,
Tailwind, PostgreSQL, Prisma, NextAuth v5, Stripe, Twilio, OpenAI. Deploys to
Vercel.

**Multi-tenancy.** `Business` is the tenant. Every SlamAI Voice model carries
`businessId`; nothing in the module is scoped to a user. Every API route passes
through `requireTenant()`, which resolves the tenant from the caller's
membership row — a `businessId` in a request body is never trusted. Mutations
are scoped with `updateMany`/`deleteMany` on `{ id, businessId }`, so another
tenant's id matches nothing rather than being edited.

`npm run test:e2e` proves this against a live server and a real database.

**Provider abstraction.** Neither vendor is baked in:

- `VoiceProvider` (`src/lib/voice/providers/`) — Twilio ships as the adapter.
  Number search, purchase, configuration, release, recordings and webhook
  verification are all behind the interface.
- `AIProvider` (`src/lib/voice/ai/`) — OpenAI ships as the adapter. Chat with
  tool calling, plus embeddings.

Adding a vendor is one file and one case statement.

**Key modules**

| Path | What lives there |
|---|---|
| `src/lib/voice/tenant.ts` | The authorization gate every request passes |
| `src/lib/voice/conversation.ts` | The call engine: tool-calling turns |
| `src/lib/voice/call-flow.ts` | Post-call: analysis → lead → usage → notifications |
| `src/lib/voice/prompt.ts` | System prompt composition, safety rules first |
| `src/lib/voice/retrieval.ts` | Knowledge search, with a keyword fallback |
| `src/lib/voice/scoring.ts` | Transparent 0–100 lead rubric |
| `src/lib/voice/plans.ts` | Pricing, limits and feature gates — one source of truth |
| `src/lib/voice/availability.ts` | Slot finding and double-booking prevention |
| `src/lib/voice/hours.ts` | Timezone-correct opening hours, no date library |

---

## A few decisions worth knowing about

**Lead scoring is a rubric, not a model call.** A business owner has to be able
to understand why a lead scored 82, and that number must not drift because a
model was updated. The AI supplies signals — urgency, intent, whether a budget
was mentioned — and `scoring.ts` turns them into a number with a written
explanation.

**Uploaded documents are not stored.** Text is extracted at upload time and the
binary is discarded. The agent only ever needs the words, and not holding
customers' documents removes a whole class of storage, retention and breach
problems.

**Transcripts are rows, not a JSON blob.** They need to be searchable and
paginated.

**Revenue figures are labelled estimates, everywhere.** They are the sum of
values the business itself set on its leads. The product never implies that is
money received.

**An unconfigured feature says so.** No AI key means the test console tells you
so. No email provider means notification attempts are logged as *skipped*, never
as sent. Nothing is faked to look complete.

---

## Testing

```bash
npm run test        # 54 unit tests, no database needed
npm run build       # production build, strict type check, lint
npm run start       # then, in another terminal:
npm run test:e2e    # 16 tenant-isolation tests against a live server
```

The unit tests cover the logic that must not drift: lead scoring, timezone and
opening-hours arithmetic across DST, the permission matrix, webhook signing and
replay rejection, HTML and text chunking, plan limits and request validation.

The end-to-end tests create two throwaway businesses and prove one cannot read,
edit or delete the other's data, that phone numbers belong to exactly one
tenant, that calendars are per-tenant, that the admin panel is invisible to
customers, and that unsigned webhooks are refused.

---

## Documentation

| Document | What it covers |
|---|---|
| [SETUP.md](./docs/SETUP.md) | Running it locally, and what each missing key costs you |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Going live, and what to monitor |
| [VOICE_PROVIDER_SETUP.md](./docs/VOICE_PROVIDER_SETUP.md) | Getting a real phone call working |
| [STRIPE_SETUP.md](./docs/STRIPE_SETUP.md) | Taking money |
| [DATABASE.md](./docs/DATABASE.md) | The schema, indexes, migrations, retention |
| [API.md](./docs/API.md) | Every endpoint and its permission |
| [N8N_INTEGRATION.md](./docs/N8N_INTEGRATION.md) | Webhooks, signatures, a worked n8n flow |
| [SECURITY.md](./docs/SECURITY.md) | What is protected and how |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | When something is not working |
| [BUILD_LOG.md](./BUILD_LOG.md) | What was built, what was decided, what is left |

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3005 |
| `npm run build` | Production build (generates the Prisma client first) |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs a running server) |
| `npm run db:push` | Push the schema (development) |
| `npm run db:studio` | Browse the database |
| `npm run db:seed:voice` | Build the ABC Plumbing demo workspace |

---

## Pricing

| Plan | Price | Included minutes |
|---|---|---|
| Starter | €99/month | 500 |
| Business | €249/month | 1,500 |
| Pro | €499/month | 4,000 |
| Enterprise | Custom | Negotiated |

Every plan starts with a 14-day free trial and no card. Prices exclude VAT.
Minutes beyond the plan allowance are billed at the plan's overage rate.

All of it is defined in `src/lib/voice/plans.ts` and nowhere else.
