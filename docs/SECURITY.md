# Security

What is protected, how, and what is left for you to do.

---

## Tenant isolation

This is the property everything else depends on. One business must never be
able to reach another's calls, transcripts, leads, customers, documents,
receptionists, appointments or billing.

**How it is enforced**

Every `/api/v1` route passes through `requireTenant()` in
`src/lib/voice/tenant.ts`. It resolves the tenant from the caller's
**membership row**, never from anything in the request. A `businessId` in a
request body is ignored.

Mutations are scoped rather than looked up:

```ts
// Correct — another tenant's id matches nothing.
await db.lead.updateMany({ where: { id, businessId: ctx.businessId }, data });

// Never done — an id from the client would be authoritative.
await db.lead.update({ where: { id }, data });
```

A cross-tenant request returns **404**, not 403: confirming a record exists is
itself a leak.

**How it is verified**

`npm run test:e2e` runs against a live server and a real database and proves it:
cross-tenant reads, writes and deletes, list leakage, agent reconfiguration,
phone number ownership, per-tenant calendars and workspace switching.

Frontend hiding is a convenience, never a control.

---

## Authentication

- NextAuth v5, JWT sessions, HTTP-only cookies, secure and `SameSite=Lax` by
  default.
- Passwords hashed with bcrypt, cost 12. Minimum 12 characters.
- Sign-in failures are deliberately vague — naming which half was wrong tells an
  attacker which emails have accounts.
- Password reset tokens are stored **hashed** (SHA-256), single use, 60 minute
  expiry, compared in constant time. A database leak cannot be replayed into
  account takeover.
- Team invitations are stored hashed, expire in 7 days, are single use, and can
  only be redeemed by the exact email address they were sent to — a forwarded
  link is useless to anyone else.

---

## Authorization

Four roles with an explicit permission matrix in `src/lib/voice/roles.ts`.
Checked server-side on every mutating route.

Nobody can promote anyone to their own level or above (`canAssignRole`), and the
last owner cannot be removed or demoted — that would lock a workspace out of its
own billing.

**Platform admin** is separate from tenancy and re-reads the role **from the
database**, not from the JWT: a token minted before a demotion still carries the
old claim. Admin routes return 404 to a customer so the panel is not advertised.

---

## Webhooks

**Inbound.** Every provider webhook verifies a signature before reading the
body. Twilio's is an HMAC over the exact URL plus the sorted POST body; Stripe's
is verified against the raw body. An unsigned webhook could otherwise make the
AI answer for any tenant, or upgrade any workspace for free.

`VOICE_SKIP_SIGNATURE_CHECK` exists for local tunnels and is **ignored when
`NODE_ENV=production`**. There is no production bypass.

**Outbound.** Each endpoint has its own HMAC-SHA256 secret, shown once at
creation. Deliveries carry a timestamp so receivers can reject replays. See
[N8N_INTEGRATION.md](./N8N_INTEGRATION.md).

---

## Input handling

- Every mutating route parses its body through a Zod schema in
  `src/lib/voice/validation.ts`. No handler decides for itself what valid means.
- Only validated keys are written. A client cannot set `status` or `isDemo` by
  adding them to a payload.
- Caller speech is escaped before it goes into TwiML XML.
- Model output is stripped of markdown before being spoken.
- Uploads are capped at 10 MB and restricted to PDF, DOCX, TXT and MD.

---

## SSRF

Three places take a URL from a tenant and fetch it server-side: knowledge web
sources, registered webhook endpoints, and notification rules on the webhook
channel. The knowledge one is the sharpest, because whatever comes back is
**stored and readable through the API** — a full-read surface, not a blind one.

**Checking the hostname string is not a control.** `169.254.169.254.nip.io` is
an ordinary public name that resolves to cloud metadata, and so is any name an
attacker registers pointing at RFC1918 space. Numeric spellings are worse: the
resolver reads `0177.0.0.1` as octal loopback and `0x7f.1` as hex, neither of
which a dotted-quad check catches.

So the rule in `src/lib/voice/egress.ts` is **resolve first, judge the address,
then pin the connection to the address that was judged**:

1. Only `http:` and `https:` are accepted.
2. The hostname is resolved with `all: true`, and the request is refused if
   **any** returned address is non-public — otherwise which record gets picked
   would decide whether the request is safe.
3. Refused ranges (`src/lib/voice/ip.ts`): loopback, `0.0.0.0/8`, all RFC1918,
   link-local including `169.254.169.254`, carrier-grade NAT `100.64/10`,
   IETF protocol assignments, benchmarking, multicast and reserved space, plus
   IPv6 loopback, unique-local, link-local and multicast, and IPv4-mapped IPv6.
   Anything not a well-formed address is refused: the classifier fails closed.
4. The connection is **pinned** to the approved address via undici's
   `connect.lookup` hook, so a name that resolves again to something internal
   between the check and the connect (DNS rebinding) cannot win the race. TLS
   SNI and the `Host` header keep the original hostname, so certificates still
   validate.
5. Redirects are never followed — a redirect is the simplest way around a host
   check — and every fetch has a timeout.

Registered webhook endpoints and notification rules are checked when they are
saved **and** again at delivery, because a hostname that was public when the
rule was created can be repointed afterwards.

Notification targets are also validated for the shape their channel needs: an
email address for `email`, an E.164 number for `sms`, an `http(s)` URL for
`webhook`. Previously `target` was a bare string, which let a webhook rule
name any host and port.

`tests/egress.test.ts` pins the address classifier, and the attack itself is
worth re-running against a deployment: point a knowledge source and a
notification webhook at loopback, cloud metadata (both by literal address and
via a public DNS name that resolves there), an RFC1918 host, and a
non-`http` scheme. All should be refused.

## Rate limiting

Public endpoints are limited per IP: signup (5 per 15 minutes), demo requests
(5 per hour), the test console (60 per 5 minutes per workspace).

**This is per instance, not global.** It stops scripted abuse and runaway AI
cost on a single-instance deployment. On a multi-instance deployment it caps
abuse per instance. If you need a global limit, back `hit()` in
`src/lib/voice/rate-limit.ts` with Redis — the signature does not change.

---

## Secrets

- No secret is ever read in client code. Anything server-only imports
  `server-only`, which makes an accidental client import a build error.
- `NEXT_PUBLIC_*` is reserved for genuinely public values.
- Webhook signing secrets are returned exactly once, at creation, and never
  again by any read endpoint.
- `.env`, `.env.local` and `*.log` are gitignored.

---

## Audit

Meaningful actions are recorded with the actor, the entity, the timestamp and
the IP: workspace changes, receptionist changes, knowledge uploads, lead edits,
appointment changes, team changes, plan changes and admin actions.

Auditing never breaks the action it records — a logging failure is swallowed and
logged to the server console.

---

## Data handling

- Uploaded documents are **not stored**. Text is extracted at upload time and
  the binary is discarded, which removes a whole class of storage, retention and
  breach problems.
- Call recordings are only made for after-hours voicemail, and only when the
  owner chooses that mode.
- Retention per plan is stated in `plans.ts`. Enforcement is a scheduled job you
  run — see [DATABASE.md](./DATABASE.md). The platform does not delete a
  customer's business records on a timer without you deciding to.

---

## What the AI will not do

Enforced in the system prompt above any owner instruction, in
`src/lib/voice/prompt.ts`:

- It never claims to be human. Asked directly, it says it is an AI assistant.
- It never invents a price, a policy or an availability.
- It never gives medical, legal or financial advice.
- It tells callers to ring the emergency services in a genuine emergency.
- It does not discuss other customers.

Owner instructions are appended **after** these and cannot override them.

---

## Before you go live

- [ ] `NEXTAUTH_SECRET` is a fresh random value, not the development one
- [ ] `DATABASE_URL` uses TLS
- [ ] `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` are your real HTTPS origin
- [ ] `VOICE_SKIP_SIGNATURE_CHECK` is unset
- [ ] Stripe is in live mode with a live webhook secret
- [ ] Database backups are on, with point-in-time recovery
- [ ] You have decided your retention policy and scheduled the job
- [ ] `npm run test:all` passes
- [ ] You have a privacy policy covering call recording and transcripts in the
      jurisdictions you operate in

---

## Reporting a vulnerability

Email the address in the repository's contact details rather than opening a
public issue.
