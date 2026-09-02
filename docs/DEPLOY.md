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

**Elite Life OS (`/life`) needs none of these.** It keeps all of its state in the
browser, so it works on a deployment with zero configuration. The variables below
are for the rest of the app.

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

## Installing Life OS as an app

Once deployed over HTTPS, open `/life` and use **Add to Home Screen** (iOS Safari)
or **Install** (Chrome). Installed is the most reliable way to run the alarms —
though the honest limits described on the Alarms screen still apply: no web app
can guarantee an alarm with the tab closed.
