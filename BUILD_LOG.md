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

- Marketing site: `/` (see the note at the end of this log)
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

---

## Phase 4–17 — The application

### API layer (`/api/v1`, `/api/webhooks`, `/api/admin`, `/api/public`)

Around 40 route files. Every tenant route opens with `requireTenant()`, which
resolves the workspace from the caller's **membership row** and checks the
role's permission before any query runs. No handler reads a `businessId` from a
request body.

**Decisions made:**

- **Cross-tenant access returns 404, not 403.** Confirming a record exists is
  itself a leak.
- **Mutations use `updateMany`/`deleteMany` scoped to `{ id, businessId }`**
  rather than `update({ where: { id } })`. Another tenant's id matches nothing,
  so a mistake fails closed rather than open.
- **Uploads are extracted, not stored.** Text is pulled out at upload time and
  the binary discarded. The agent only needs the words, and not holding
  customers' documents removes a class of storage and breach problems.
- **SSRF is blocked in one place.** `isPrivateHost()` guards both places a
  tenant URL is fetched server-side (knowledge sources, webhook endpoints).
  Redirects are not followed.
- **The admin panel re-reads the role from the database**, not the JWT — a token
  minted before a demotion still carries the old claim.
- **Post-call processing is idempotent** on `Lead.callId`, so a retried carrier
  webhook cannot create a second lead.

### Dashboard (`/app`)

Server-guarded shell, a shared component kit, and pages for the dashboard, the
agent builder, knowledge, calls, transcripts, leads, appointments, the test
console, analytics, billing, settings (eight tabs), onboarding and admin.

**Decisions made:**

- **The layout guard runs on the server.** No protected markup is generated for
  a signed-out visitor, and there is no redirect flash.
- **The onboarding wizard reuses the settings components** rather than keeping
  simplified copies that would drift apart.
- **The test console runs the real engine** with `persist: false`. What an owner
  hears while testing is what a caller gets.
- **Revenue is labelled an estimate everywhere it appears.** It is the sum of
  values the owner set on their own leads.
- **Server-only modules were split where a client page needed a constant**
  (`metrics.ts`, `signing.ts`, `labels.ts`), rather than dropping `server-only`
  from a module that touches the database.

### Marketing site (`/`)

Landing page, pricing with a full comparison table, and a demo request form
backed by a real, rate-limited endpoint that files into the admin panel.

The hero shows the agent handling an actual emergency call — establish urgency,
take the address, offer a real slot — because that is the product, and a static
screenshot is not.

## Phase 18 — Testing

**54 unit tests** over the logic that must not drift: lead scoring, timezone and
opening-hours arithmetic across DST and midnight boundaries, the permission
matrix, webhook signing and replay rejection, HTML and text chunking, plan
limits and request validation. No database needed.

**16 end-to-end tests** against a live server and a real database. This is the
only way to actually prove tenant isolation — a mocked session would be testing
the mock. They cover cross-tenant reads, writes and deletes, list leakage, agent
reconfiguration, phone number ownership, per-tenant calendars, workspace
switching, the hidden admin panel, unsigned webhook rejection and the pagination
cap.

**A call simulator** (`npm run simulate:call`) posts to the real carrier
webhooks with no carrier account, exercising tenant resolution, the conversation
engine, transcript persistence and post-call processing exactly as a live call
does.

**Verified by running it**, not by assuming:

- Production build: clean, no TypeScript errors, no lint warnings
- 54 unit tests: pass
- 16 end-to-end tests against a live server: pass
- A simulated inbound call: tenant resolved from the dialled number, greeting
  spoken, turns persisted, call finalised, usage metered

**Fixed while testing:**

- `parseBody` inferred a Zod schema's *input* type instead of its output, so
  defaults were typed as possibly undefined.
- `pdf-parse` v2 exposes a `PDFParse` class, not a default export.
- Webhook signing lived in a `server-only` module and could not be unit tested;
  extracted to `signing.ts`, which doubles as the reference implementation
  shipped in the integration docs.
- The development signature bypass sat *after* the auth-token check, so a call
  could not be simulated without a carrier account at all. Moved ahead of it and
  hard-gated on `NODE_ENV`.
- A call the AI could not take was recorded as `answered`, which would hide a
  broken deployment behind healthy-looking numbers. It is now `failed`, and
  post-call analysis can no longer upgrade a failed call.

## Phase 20 — Documentation

`README.md`, `SETUP.md`, `DEPLOYMENT.md`, `VOICE_PROVIDER_SETUP.md`,
`STRIPE_SETUP.md`, `DATABASE.md`, `API.md`, `N8N_INTEGRATION.md`,
`SECURITY.md`, `TROUBLESHOOTING.md`, and a complete `.env.example` that states
what each missing key actually costs you.

---

## What is deliberately not built

Being explicit about this matters more than a longer feature list.

| Not built | Why, and what to do instead |
|---|---|
| **Direct calendar sync** (Google, Microsoft) | The appointment model, availability engine and integration table are all in place, but no OAuth flow is wired. Bookings live in SlamAI. Use a webhook into n8n to mirror them into a calendar today. |
| **Direct CRM integrations** (HubSpot, Salesforce, GoHighLevel) | Same reasoning. The webhook path reaches all of them through n8n or Zapier now. Settings → Integrations lists them as *Planned*, not as available. |
| **Automatic overage billing to Stripe** | Usage is metered and the overage is calculated and shown. Reporting it to a Stripe metered price is one function call, left undone because you should decide your overage policy before charging for it. |
| **Automatic retention deletion** | Per-plan retention is defined and documented with the SQL. It is not run on a timer — the platform should not delete a customer's business records without you deciding to. |
| **Real-time streaming voice** | The current loop is turn-based (speak → listen → reply), which is what a carrier `<Gather>` gives you. It works and it is honest about its latency. `runTurn` is transport agnostic, so a streaming adapter implements the same interface. |
| **Global rate limiting** | The limiter is per instance. That stops scripted abuse and runaway AI cost. A multi-instance deployment that needs a global limit backs `hit()` with Redis — the signature does not change. |
| **Email delivery of team invitations** | Invitations are created and hashed correctly; without a mail provider the link is returned to the inviter to send. Better than an invitation that silently never arrives. |

## Phase 21 — SlamAI Voice becomes the front door

The landing page for SlamAI Voice now serves `/`. It is the real page, not a
redirect — a redirect costs a hop and splits the domain's SEO across two URLs.

| URL | What it serves |
|---|---|
| `/` | The SlamAI Voice landing page |
| `/pricing` | Pricing and the full plan comparison |
| `/demo` | Book a demo |
| `/signup` | Create a workspace |
| `/login` | Sign in — **one** page for the whole platform |
| `/app/*` | The product |
| `/aios` | The original AIOS marketing page, still there |
| `/dashboard`, `/life` | The original AIOS app, untouched |

**Decisions made:**

- **The old `/voice/*` URLs are permanent (308) redirects**, not deletions.
  Anything already shared keeps working and search engines are told where the
  page moved.
- **One sign-in page, at `/login`.** Two login pages on one domain is a real
  problem: a customer bookmarks one, signs in, and lands in the wrong product.
  The page is now styled as SlamAI Voice and decides where to send someone
  *after* sign-in — a Voice workspace goes to `/app`, an account without one
  goes to the AIOS dashboard. The AIOS login's "session could not be read back"
  diagnostic and its pending-plan-to-checkout behaviour were both preserved
  rather than dropped in the rewrite.
- **`?next=` is honoured but only for same-site paths.** An absolute URL there
  would be an open redirect.
- **The public pages sit in a `(marketing)` route group**, so they share the
  product's dark ground without adding a path segment.
- **The AIOS auth pages' logo now links to `/aios`**, not `/` — their logo says
  "SlamAI AIOS", so sending them to the Voice landing would be a dead end.
- **Metadata is now a title template.** The root supplies
  `%s — SlamAI Voice`; `/aios` overrides it absolutely so it is not branded as
  a Voice page.

**Verified by running it:**

- `/` serves the SlamAI Voice landing with the correct title and hero
- Every old `/voice/*` URL 308s to its new home
- `/app` is still guarded; the AIOS app at `/aios`, `/dashboard` and `/life`
  still works
- Sign-in routing checked against two real accounts: the demo workspace owner
  lands on `/app`, an account with no workspace lands on `/dashboard`
