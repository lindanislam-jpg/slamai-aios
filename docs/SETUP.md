# Running SlamAI Voice locally

Everything below assumes a clean machine with Node 20+ and a PostgreSQL 14+
database you can write to.

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env.local
cp .env.local .env          # Prisma reads .env, Next reads .env.local
```

Fill in, at minimum:

| Variable | Why |
|---|---|
| `DATABASE_URL` | Where everything is stored |
| `DIRECT_URL` | Same value unless your host separates pooled and direct connections |
| `NEXTAUTH_SECRET` | Signs session cookies — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3005` in development |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` in development |

The app **runs** without any other key. What each missing key costs you:

| Missing | What stops working | What you see instead |
|---|---|---|
| `AI_API_KEY` | The AI cannot answer or analyse calls | The test console says the AI provider isn't configured; knowledge search falls back to keyword matching |
| `VOICE_PROVIDER_*` | You cannot buy or connect real numbers | Phone settings shows your webhook URL so you can point a number at it manually |
| `STRIPE_*` | No subscriptions | Billing says billing isn't connected; plans cannot be bought |
| `RESEND_API_KEY` | No email notifications | Notification attempts are logged as **skipped**, never as sent |

That is deliberate. Nothing is faked — an unconfigured feature says so.

## 3. Create the schema

```bash
npm run db:push        # push the schema (development)
npm run db:generate    # regenerate the Prisma client
```

For production use migrations instead — see [DATABASE.md](./DATABASE.md).

## 4. Seed the demo workspace (recommended)

```bash
npm run db:seed:voice
```

This creates **ABC Plumbing**: 267 calls with real transcripts, scored leads,
booked appointments, a knowledge base and 60 days of usage. It is the fastest
way to see what the product looks like in use, and it is what you show a
prospect.

Sign in with the credentials it prints (`demo@slamai.io` by default — set
`DEMO_PASSWORD` before running to choose your own).

Running it again replaces the previous demo rather than stacking duplicates.

## 5. Run

```bash
npm run dev
```

| URL | What it is |
|---|---|
| http://localhost:3005/voice | The SlamAI Voice marketing site |
| http://localhost:3005/voice/signup | Create a workspace |
| http://localhost:3005/app | The product |
| http://localhost:3005/app/admin | The platform admin panel (needs `User.role = "admin"`) |
| http://localhost:3005/dashboard | The original SlamAI AIOS app, untouched |

## 6. Make yourself a platform admin

```bash
psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'admin' WHERE email = 'you@example.com';"
```

Sign out and back in. The admin link appears at the bottom of the sidebar.

## 7. Check it works

```bash
npm run test           # unit tests, no database needed
npm run build          # production build, type check and lint
npm run start          # then, in another terminal:
npm run test:e2e       # tenant isolation against a live server
```

`npm run test:e2e` creates two throwaway businesses and proves one cannot read,
edit or delete the other's data. It is safe to run against a development
database and never touches existing records.

## Next

- [VOICE_PROVIDER_SETUP.md](./VOICE_PROVIDER_SETUP.md) — get a real phone call working
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) — take money
- [DEPLOYMENT.md](./DEPLOYMENT.md) — put it live
