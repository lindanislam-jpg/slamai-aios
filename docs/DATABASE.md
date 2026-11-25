# The database

PostgreSQL, accessed through Prisma. The schema is in `prisma/schema.prisma`.

---

## Tenancy

Every SlamAI Voice model carries `businessId`. There is no model in the module
scoped directly to a user. That is the whole design:

- `Business` is the tenant.
- `Membership` joins a `User` to a `Business` with a role. One user can belong
  to several businesses — an agency managing clients, say.
- Every query filters on a `businessId` that came from
  `requireTenant()` in `src/lib/voice/tenant.ts`, never from a request body.

Mutations use `updateMany` / `deleteMany` scoped to `{ id, businessId }` rather
than `update({ where: { id } })`. Another tenant's id simply matches nothing,
which is why a cross-tenant write returns 404 rather than succeeding.

The end-to-end suite (`npm run test:e2e`) proves this against a live server.

---

## The models

**Tenancy and access**
| Model | What it is |
|---|---|
| `Business` | The tenant. Everything hangs off it. |
| `Membership` | A user's role in a business |
| `Invitation` | A pending team invite. Only the token hash is stored. |
| `Subscription` | Plan id and Stripe identifiers. Never a price. |
| `AuditLog` | Who did what, when, from where |

**The AI**
| Model | What it is |
|---|---|
| `ReceptionAgent` | A configured receptionist: voice, personality, rules |
| `Service` | What the business sells. The only prices the AI may quote. |
| `BusinessHour` | One row per weekday, wall-clock times in the tenant's zone |
| `KnowledgeSource` | A document, page or FAQ set |
| `KnowledgeChunk` | One retrievable passage plus its embedding |

**Calls and outcomes**
| Model | What it is |
|---|---|
| `PhoneNumber` | `e164` is globally unique — this is how an inbound call resolves its tenant |
| `VoiceCall` | One call, its outcome and its analysis |
| `CallTurn` | One utterance. Rows, not a JSON blob, so transcripts are searchable. |
| `Customer` | A person, deduplicated on phone within the tenant |
| `Lead` | A follow-up. `callId` is unique, which makes post-call processing idempotent. |
| `Appointment` | A booking. Overlap is checked before every write. |

**Operations**
| Model | What it is |
|---|---|
| `NotificationRule` / `NotificationLog` | What to send where, and what actually happened |
| `WebhookEndpoint` | An outbound integration and its signing secret |
| `UsageEvent` | One row per billable action |
| `BusinessIntegration` | Per-provider connection state |
| `DemoRequest` | SlamAI's own sales pipeline. Not tenant-scoped. |

---

## Indexes

Every list view is indexed on the shape it actually queries:

- `VoiceCall`: `[businessId, startedAt]` and `[businessId, outcome]`
- `Lead`: `[businessId, status]` and `[businessId, createdAt]`
- `Appointment`: `[businessId, startsAt]` and `[businessId, status]`
- `UsageEvent`: `[businessId, period, metric]` — the aggregation runs in the
  database, not in Node
- `CallTurn`: `[callId, offsetSec]`

Unique constraints that carry real meaning:

- `PhoneNumber.e164` — a number belongs to exactly one tenant
- `Lead.callId` — one lead per call, so a retried webhook cannot duplicate it
- `Customer [businessId, phone]` — dedupe within a tenant, not across tenants
- `Membership [userId, businessId]`
- `BusinessHour [businessId, weekday]`

---

## Migrations

Development:

```bash
npm run db:push          # fast, no migration file
```

Production — always use a migration so the change is reviewable and reversible:

```bash
npx prisma migrate dev --name describe_your_change     # create it
npx prisma migrate deploy                              # apply it
```

Run `prisma migrate deploy` as part of your release, before the new code starts
serving traffic.

---

## Knowledge search and pgvector

`KnowledgeChunk.embedding` is a plain `Float[]`. Cosine similarity is computed
in Node over the tenant's own chunks in `src/lib/voice/retrieval.ts`. That is
exact, needs no database extension, and is fast at the scale one business's
knowledge base reaches — hundreds to low thousands of passages, capped at 5,000
scanned per query.

If a tenant outgrows it, the upgrade is confined to that one file:

1. `CREATE EXTENSION vector;`
2. Change the column to `vector(1536)` and add an ivfflat index.
3. Replace `search()` with an `ORDER BY embedding <=> $1 LIMIT n` query.

Nothing outside `retrieval.ts` changes.

---

## Retention

`VoicePlan.limits.retentionDays` states how long call history is kept per plan.
Enforcement is a scheduled job you run yourself — the platform does not delete
customer data on a timer without you deciding to:

```sql
DELETE FROM "VoiceCall"
WHERE "businessId" = $1 AND "startedAt" < now() - interval '90 days';
```

`CallTurn` cascades from `VoiceCall`.

---

## Backups

Use your host's automated backups (Neon, Supabase and RDS all provide
point-in-time recovery). Transcripts and leads are the customer's business
records — losing them is not recoverable by re-running anything.
