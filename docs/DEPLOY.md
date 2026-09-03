# Deploying

The fastest path to a real URL — one you can open on your phone and install as an
app — is Vercel, which builds Next.js with no configuration.

## Option A — click it (two minutes, no secrets in the repo)

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. **Import** `lindanislam-jpg/slamai-aios`. Vercel detects Next.js on its own:
   the build command is `npm run build`, no overrides needed.
3. Add the environment variables you need (see the table below) and click
   **Deploy**.
4. Every later push to `main` redeploys automatically.

Your Life OS lands at `https://<your-project>.vercel.app/life`.

## Option B — deploy from CI

`.github/workflows/deploy.yml` deploys `main` on every push. It skips itself
until three repository secrets exist, so nothing breaks before you set them up:

```bash
npm i -g vercel
vercel login
vercel link          # creates .vercel/project.json with the two IDs
cat .vercel/project.json
```

Then add these under **Settings → Secrets and variables → Actions**:

| Secret              | Where it comes from                                |
| ------------------- | -------------------------------------------------- |
| `VERCEL_TOKEN`      | vercel.com → Account Settings → Tokens              |
| `VERCEL_ORG_ID`     | `orgId` in `.vercel/project.json`                   |
| `VERCEL_PROJECT_ID` | `projectId` in `.vercel/project.json`               |

`.vercel/` is local only — do not commit it.

## Environment variables

**Elite Life OS (`/life`) runs with none of these.** It keeps its state in the
browser, so it works on a deployment with zero configuration — one device, no
account. Cross-device sync is the one feature that needs setup: see
[Turning on sync](#turning-on-sync) below.

| Variable                            | Needed for                               | Without it                                     |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`        | Everything backed by Prisma              | Auth and the business dashboard fail at runtime |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`   | Sign-in                                  | Auth is unusable                                |
| `OPENAI_API_KEY`                    | AI features, incl. the model-backed coach | The Life OS coach answers locally on-device     |
| `LIFE_COACH_MODEL`                  | Choosing the coach's model               | Defaults to `gpt-4o-mini`                       |
| `STRIPE_*`                          | Billing                                  | Checkout and the portal are unavailable         |
| `TWILIO_*`                          | The voice agent                          | Calls are not answered                          |

Set `NEXTAUTH_URL` to your deployed origin (e.g. `https://slamai.vercel.app`), and
`TWILIO_WEBHOOK_BASE_URL` likewise if you use the voice agent.

## Turning on sync

Without this, Life OS is one device per browser. With it, you sign in and the
same day follows you between the laptop and the phone.

It needs a Postgres database and three environment variables. Any Postgres
works; Neon's free tier needs no card.

1. **Create the database.** Go to <https://neon.tech>, sign in with GitHub, and
   create a project. Copy the connection string it shows — it looks like
   `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
2. **Add the variables** in Vercel → your project → Settings → Environment
   Variables, for Production:

   | Variable          | Value                                                         |
   | ----------------- | ------------------------------------------------------------- |
   | `DATABASE_URL`    | the Neon connection string                                     |
   | `DIRECT_URL`      | the same string                                                |
   | `NEXTAUTH_SECRET` | any long random string — generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL`    | your deployed origin, e.g. `https://slamai-aios.vercel.app`     |

   Never paste these into a chat, a screenshot, or a shell prompt. They belong
   only in Vercel, and in a local `.env.local`, which is gitignored.
3. **Create the tables.** Locally, with the same `DATABASE_URL` in `.env`:

   ```bash
   npx prisma db push
   ```

4. **Redeploy**, then open `/life`, register an account at `/register`, and sign
   in. Settings → Sync will read **Synced** instead of **This device only**.
   Sign in on the second device with the same account and it picks up your log.

### What sync does and does not guarantee

- Each **day** is merged on its own, so a morning logged on the laptop and an
  evening logged on the phone both survive.
- **Settings, north star, challenge, people and places** are single values that
  cannot be combined. The device changed most recently wins all of them.
- There are **no tombstones**: deleting a person while a second device is offline
  will bring them back when that device next syncs.
- Offline edits are kept on the device and pushed when the network returns.
- **Reset everything** clears the stored copy too, but another device still open
  and signed in holds its own copy and will share it back. Close or reset it too.

Run `npx tsx scripts/life-sync-check.ts` to re-verify the merge rules.

## Installing Life OS as an app

Once deployed over HTTPS, open `/life` and use **Add to Home Screen** (iOS Safari)
or **Install** (Chrome). Installed is the most reliable way to run the alarms —
though the honest limits described on the Alarms screen still apply: no web app
can guarantee an alarm with the tab closed.
