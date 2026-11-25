# API reference

Two surfaces:

- `/api/v1/*` — the tenant API. Session-authenticated, tenant-scoped.
- `/api/webhooks/*` — inbound from providers. Signature-authenticated.

Plus `/api/admin/*` for SlamAI staff and `/api/public/*` for the marketing site.

---

## How authorization works

Every `/api/v1` route begins the same way:

```ts
const gate = await requireTenant({ permission: "leads.write", write: true });
if (!gate.ok) return gate.response;
// gate.ctx.businessId is now the only tenant id this request may touch.
```

`requireTenant()` proves four things before a handler runs:

1. There is a session.
2. The caller is a **member** of the business. A `businessId` in the request
   body is never trusted.
3. The caller's role carries the permission.
4. The workspace is not suspended (reads still work so a suspended tenant can
   see its data and pay its bill; writes are refused).

A request for another tenant's record returns **404, not 403** — confirming a
record exists is itself a leak.

## Errors

Every non-2xx response is `{ "error": "A sentence you can show a user." }`.
Stack traces and driver errors are logged server-side and never returned.

| Status | Meaning |
|---|---|
| 400 | The input is invalid. The message names the field. |
| 401 | Not signed in. |
| 403 | Signed in, but not allowed — or the workspace is suspended. |
| 404 | Does not exist, or does not belong to your workspace. |
| 409 | Conflict — a double booking, or a number another tenant owns. |
| 500 | Our fault. Logged. |

## Pagination

List endpoints take `?page=` and `?pageSize=` (default 25, **capped at 100**)
and return:

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 25, "pageCount": 1 }
```

---

## Endpoints

### Workspace

| Method | Path | Permission |
|---|---|---|
| `POST` | `/api/v1/signup` | public, rate limited |
| `GET` `PATCH` | `/api/v1/business` | `business.read` / `business.write` |
| `GET` `PUT` | `/api/v1/business/hours` | `business.read` / `business.write` |
| `GET` `POST` `PATCH` | `/api/v1/workspaces` | session only |
| `PATCH` | `/api/v1/onboarding` | `business.write` |

### The AI

| Method | Path | Permission |
|---|---|---|
| `GET` `POST` | `/api/v1/agents` | `agent.read` / `agent.write` |
| `GET` `PATCH` `DELETE` | `/api/v1/agents/[id]` | `agent.read` / `agent.write` |
| `GET` `POST` | `/api/v1/services` | `business.read` / `business.write` |
| `PATCH` `DELETE` | `/api/v1/services/[id]` | `business.write` |
| `POST` | `/api/v1/test-call` | `agent.read`, rate limited |

`POST /api/v1/test-call` runs the real conversation engine with persistence
off, and returns the reply, the action taken, every tool that ran and every
knowledge passage quoted.

### Knowledge

| Method | Path | Permission |
|---|---|---|
| `GET` `POST` | `/api/v1/knowledge` | `knowledge.read` / `knowledge.write` |
| `GET` `DELETE` | `/api/v1/knowledge/[id]` | `knowledge.read` / `knowledge.write` |
| `POST` | `/api/v1/knowledge/[id]/reindex` | `knowledge.write` |

`POST /api/v1/knowledge` accepts JSON (`url`, `text`, `faq`) or multipart form
data with a `file` (PDF, DOCX, TXT, MD — 10 MB cap). Only the extracted text is
stored; the original file is never kept.

### Calls, leads and appointments

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/v1/calls` | `calls.read` |
| `GET` | `/api/v1/calls/[id]` | `calls.read` |
| `GET` `POST` | `/api/v1/leads` | `leads.read` / `leads.write` |
| `GET` `PATCH` `DELETE` | `/api/v1/leads/[id]` | `leads.read` / `leads.write` |
| `GET` `POST` | `/api/v1/appointments` | `appointments.read` / `appointments.write` |
| `PATCH` `DELETE` | `/api/v1/appointments/[id]` | `appointments.write` |
| `GET` | `/api/v1/appointments/availability` | `appointments.read` |

`availability` uses the **same** slot finder the AI uses on a call, so the two
can never disagree.

### Numbers, team and integrations

| Method | Path | Permission |
|---|---|---|
| `GET` `POST` | `/api/v1/phone-numbers` | `phone.read` / `phone.write` |
| `PATCH` `DELETE` | `/api/v1/phone-numbers/[id]` | `phone.write` |
| `GET` | `/api/v1/phone-numbers/search` | `phone.write` |
| `GET` | `/api/v1/phone-numbers/owned` | `phone.write` |
| `GET` | `/api/v1/team` | `team.read` |
| `POST` | `/api/v1/team/invite` | `team.write` |
| `PATCH` `DELETE` | `/api/v1/team/[id]` | `team.write` |
| `POST` | `/api/v1/team/accept` | session only |
| `GET` `POST` | `/api/v1/notifications` | `business.read` / `business.write` |
| `DELETE` | `/api/v1/notifications/[id]` | `business.write` |
| `GET` `POST` | `/api/v1/webhook-endpoints` | `integrations.read` / `integrations.write` |
| `PATCH` `DELETE` | `/api/v1/webhook-endpoints/[id]` | `integrations.write` |

### Reporting and billing

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/v1/dashboard` | membership |
| `GET` | `/api/v1/analytics` | `analytics.read` |
| `GET` | `/api/v1/usage` | membership |
| `GET` | `/api/v1/audit` | `audit.read` (Business plan and up) |
| `GET` | `/api/v1/billing` | `billing.read` |
| `POST` | `/api/v1/billing/checkout` | `billing.write` |
| `POST` | `/api/v1/billing/portal` | `billing.write` |

---

## Inbound webhooks

| Path | From | Auth |
|---|---|---|
| `/api/webhooks/twilio/voice` | carrier | signature |
| `/api/webhooks/twilio/respond` | carrier | signature |
| `/api/webhooks/twilio/status` | carrier | signature |
| `/api/webhooks/twilio/recording` | carrier | signature |
| `/api/webhooks/stripe` | Stripe | signature |

An unsigned request to any of these is rejected. There is no bypass in
production — `VOICE_SKIP_SIGNATURE_CHECK` is ignored when `NODE_ENV` is
`production`.

## Outbound webhooks

See [N8N_INTEGRATION.md](./N8N_INTEGRATION.md) for the payload shape, the
signature scheme and a worked n8n example.

## Public

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/public/demo-request` | Rate limited to 5 per hour per IP |

## Admin

`/api/admin/overview`, `/api/admin/businesses`, `/api/admin/businesses/[id]`,
`/api/admin/demo-requests`.

Gated on a **database** role re-check, not a JWT claim — a token minted before a
demotion would still carry the old claim. To a customer these return **404**, so
the panel's existence is not advertised.
