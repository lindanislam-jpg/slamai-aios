# SlamAI Voice — Build Log

A running record of what was built, what was decided and what is left.

---

## Phase 1 — Inspect the existing project

**Found:** a working Next.js 15 / React 19 / TypeScript app called *SlamAI AIOS*
(Prisma + Postgres, NextAuth v5 credentials, Stripe, Twilio, OpenAI, Tailwind),
containing a broad single-user "AI business suite" (CRM, agents, documents,
campaigns, websites) and a separate personal "Life OS".

It already had a genuinely working Twilio voice loop: signature verification,
TwiML `<Gather>` → OpenAI → `<Say>`, human transfer, transcript persistence.

**Gaps against the SlamAI Voice brief:** everything hangs off `User`, so there
is no tenant. One voice agent per user. No knowledge base, no lead scoring, no
appointments, no business hours, no usage metering, no admin panel, no
provider abstraction, no team roles.

**Decision:** do *not* rewrite AIOS. SlamAI Voice is built as a properly
multi-tenant product module inside the same repository, reusing the auth,
Stripe and Twilio plumbing. Existing AIOS routes are untouched.

- Marketing site: `/voice`
- Product app: `/app/*`
- Tenant API: `/api/v1/*`
- Provider webhooks: `/api/webhooks/*`

---

## Phase 2/3 — Architecture and database

Added 19 tenant-scoped Prisma models. Every one carries `businessId`; nothing
in the module is scoped to a user directly.

`Business`, `Membership`, `Invitation`, `Subscription`, `ReceptionAgent`,
`Service`, `BusinessHour`, `KnowledgeSource`, `KnowledgeChunk`, `PhoneNumber`,
`VoiceCall`, `CallTurn`, `Customer`, `Lead`, `Appointment`,
`NotificationRule`, `NotificationLog`, `UsageEvent`, `BusinessIntegration`,
`WebhookEndpoint`, `AuditLog`, plus the non-tenant `DemoRequest`.

**Decisions made:**

- **New model names, not extensions of the AIOS ones.** `VoiceCall` rather
  than reusing `CallLog`, `Customer`/`Lead` rather than `Contact`. Mixing a
  single-user model with a tenant model is how tenant leaks happen.
- **Transcripts are rows (`CallTurn`), not a JSON blob.** They need to be
  searchable and paginated.
- **Embeddings live in a `Float[]` column** and cosine similarity is computed
  in Node. Exact, no database extension, fast at per-business scale. The
  pgvector upgrade path is documented and confined to `retrieval.ts`.
- **`PhoneNumber.e164` is globally unique**, so an inbound webhook resolves the
  owning tenant from the dialled number alone.
- **`Lead.callId` is unique**, which makes post-call processing idempotent
  against provider webhook retries.
- **Prices are never stored per-tenant.** Plan definitions live in
  `src/lib/voice/plans.ts`; only the plan id and Stripe ids are persisted.

Schema pushed to Postgres and verified.

## Phase 3b — Domain libraries (`src/lib/voice/`)

| File | What it does |
|---|---|
| `roles.ts` | 4 roles, explicit permission matrix, role-assignment rank |
| `plans.ts` | Pricing, limits and feature gates — single source of truth |
| `tenant.ts` | **The security gate.** Resolves + authorizes every request |
| `audit.ts` | Append-only action log; never breaks the action it records |
| `usage.ts` | Metered usage events and per-period aggregation |
| `industries.ts` | 19 trades with prompt guidance, services, emergency words |
| `personalities.ts` | 6 agent personalities |
| `voices.ts` | TTS voice catalogue |
| `hours.ts` | Timezone-correct opening hours (Intl, no date library) |
| `availability.ts` | Slot finding and double-booking prevention |
| `scoring.ts` | Transparent 0–100 lead rubric (not a model call) |
| `chunking.ts` | Dependency-free HTML→text and passage chunking |
| `retrieval.ts` | Embedding search with keyword fallback |
| `prompt.ts` | Composes the receptionist system prompt |
| `conversation.ts` | **The call engine.** Tool-calling turn loop |
| `call-flow.ts` | Post-call analysis → lead → usage → notifications |
| `notifications.ts` | Email / SMS / webhook fan-out |
| `webhooks.ts` | Signed outbound delivery (n8n, Zapier, CRMs) |
| `rate-limit.ts` | Per-instance limiter for public endpoints |
| `validation.ts` | Zod schemas for every mutating route |
| `ai/*` | AI provider interface + OpenAI adapter |
| `providers/*` | Voice provider interface + Twilio adapter |

**Decisions made:**

- **The conversation engine is shared** between the live Twilio webhook and the
  in-dashboard test console. What an owner hears while testing is exactly what
  a caller gets — no separate mock path.
- **Lead scoring is a rubric, not a model call.** An owner has to be able to
  understand why a lead scored 82, and the number must not drift when a model
  is updated. The AI supplies signals; `scoring.ts` turns them into a number.
- **Hard rules sit above owner instructions in the prompt.** An owner can shape
  tone and process, but cannot instruct the agent to invent prices or claim to
  be human.
- **Tool calls are capped at two rounds per turn.** A phone caller cannot wait
  longer, and it bounds cost per turn.
- **Notifications record "skipped" when a transport is unconfigured**, so the
  dashboard can say exactly what is missing rather than implying delivery.

TypeScript: clean.
