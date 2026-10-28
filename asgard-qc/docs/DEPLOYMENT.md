# Setup and deployment

## Requirements
- Node.js 20+ (22 LTS recommended)
- PostgreSQL 14+ (tested on 16)
- Disk for evidence photos (plan ~3–6 MB per photo) or an S3-compatible bucket
- HTTPS in production (session cookies are `Secure`)

## First-time setup
```bash
cd asgard-qc
npm ci
cp .env.example .env     # fill in DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (≥10 chars)
npx prisma migrate deploy
npm run db:seed          # first administrator; SEED_DEMO_DATA=true adds DEMO records
npm run build
npm start                # http://<server>:3010
```
Health check (no login): `GET /api/health`.

Schedule `npm run notifications:run` every 15 minutes (reminders also refresh at most every 10 minutes when someone opens the app), and `npm run backup` daily.

## Deployment options

| Option | Fit | Notes |
|---|---|---|
| **On-premises server / VM** (Windows or Linux) behind the company reverse proxy (IIS/nginx) with TLS | Best fit for factory evidence and internal use | Local storage driver; data stays on site; IT controls backup. Run with a process manager (pm2, NSSM, systemd). |
| **Docker container** + managed Postgres | Good | Mount `STORAGE_DIR` as a persistent volume. |
| **Vercel** (preview / demo) | Good for a hosted preview | See *Vercel* below. Private Vercel Blob storage and Neon Postgres. Very large photo batches and PDF packs can hit function time limits. |
| **Netlify** (preview / demo) | Good for a hosted preview | `netlify.toml` included; Netlify DB + private Netlify Blobs selected automatically. |
| **Azure App Service / AWS** with managed Postgres + blob/S3 | Good for cloud | Use S3 driver (Azure Blob needs an S3-compatible gateway or a new driver). |

### Vercel

1. Vercel → **Add New → Project → Import** the Git repository. Set **Root Directory** to `asgard-qc` (the framework and build command come from `vercel.json`).
2. In the project's **Storage** tab, connect a **Neon** Postgres database (sets `DATABASE_URL` / `DATABASE_URL_UNPOOLED`) and a **Blob** store (sets `BLOB_READ_WRITE_TOKEN`; files are stored with private access).
3. **Settings → Environment Variables** (mark as sensitive): `ADMIN_EMAIL`, `ADMIN_PASSWORD`; for a demo also `SEED_DEMO_DATA=true` and `DEMO_USER_PASSWORD`; optionally `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for AI photo review.
4. **Redeploy**. The build applies migrations, creates the admin and (if asked) demo data with demo photos, then builds. Branches other than the production branch get preview URLs.
5. To remove demo data from a hosted database without signing in, set `SEED_DEMO_DATA=false` and `PURGE_DEMO_DATA=true` and redeploy (same as Settings → Data → Purge demo data). Remove `PURGE_DEMO_DATA` afterwards.

Approvals you will need: IT (hosting, TLS, network access from the factory floor/Wi-Fi, backups), Information security / data owner (storage of factory photos and customer references, use of any AI service), Quality Manager (release rules, required evidence categories, checklist templates and acceptance criteria, role permissions).

## Updating
```bash
git pull && npm ci && npx prisma migrate deploy && npm run build && restart
```
Migrations are additive; take a backup first.

## Moving to its own repository
The app has no imports from the parent repo. Copy the `asgard-qc` folder (plus the `asgard-qc` CI job) into a new repository; nothing else changes.

## Security notes
- Passwords: bcrypt (cost 12); 5 failed sign-ins → 15-minute lockout; sessions 12 h, stored hashed, revoked on password/role change or deactivation.
- Every API route and server action re-checks permissions server-side; uploads are validated by file signature, size and batch limits; files are served with `nosniff` and never from a public path.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- No secrets in client code; all configuration is server-side environment variables.
- Not yet implemented: SSO (Entra ID/Azure AD), MFA, a content-security-policy header — recommended before internet exposure. Keep the app on the internal network/VPN until then.

## Scheduled alert evaluation

`npm run notifications:run` evaluates every Smart Quality Alert rule and refreshes in-app reminders. The app also runs it when someone opens a page and the last scan is over 10 minutes old, and after CMR changes. On a server, schedule it (e.g. every 15 minutes) with cron. On Vercel no cron is configured yet; evaluation happens on page use.

## One-off historical inspection import (hosted builds)

`INSPECTION_IMPORT_GZ` (base64 of gzip of the JSON records) + `INSPECTION_IMPORT_SHA256` make the build import transcribed historical inspection records through the audited inspection service. Records keep the original inspector and date, name their SharePoint source, are submitted for Quality Manager review only when complete, and are skipped if already imported. Blank both variables after the deploy.

`NCR_IMPORT_GZ` + `NCR_IMPORT_SHA256` (same encoding) handle failed historical inspections. An entry with `mode: "transcribe"` copies an NCR that already exists in the paper NCR/CAPA register, keeping its number, dates and status. An entry with `mode: "raise"` raises a new Open NCR, through the audited NCR service, for a failure that has no NCR anywhere, so the Quality Manager can investigate or cancel it. Both kinds link to the inspection, and re-runs skip entries already applied. Blank both variables after the deploy.

## Preview deployments and the database

The Neon integration gives Preview the same database (and the Blob token the same store) as Production. To protect live records:

- `vercel.json` → `ignoreCommand` (`scripts/vercel-ignore.sh`) skips every non-production build.
- `scripts/deploy-build.sh` never migrates, seeds or imports data outside production.
- `src/middleware.ts` returns 503 for any running preview deployment.

All three lift only when `PREVIEW_DB_ISOLATED=true` is set for the **Preview** environment. Set it only after previews have their own database: in Vercel → Storage → the Neon database → Settings, enable a **database branch for Preview deployments** (or point Preview's `DATABASE_URL`/`DATABASE_URL_UNPOOLED` at a separate database), and give Preview its own Blob store token.

## Scheduled whole-system review (09:00, 12:00, 18:00 Europe/Dublin)

**How it runs.** `vercel.json` registers six once-a-day Vercel Cron Jobs that call `GET /api/cron/system-review` at 08, 09, 11, 12, 17 and 18 UTC. Ireland is UTC+0 in winter and UTC+1 in summer, so each Dublin slot is covered in both seasons. The endpoint works out which Dublin slot is due and runs it once — the run key `YYYY-MM-DD@HH:MM` is unique in the database, so repeated, overlapping or unexpected calls do nothing.

- **Vercel Hobby:** cron jobs may fire at any minute within their hour, so a "09:00" review runs between 09:00 and 09:59 Irish time. On Vercel Pro they fire on the minute.
- **Missed slots:** a slot can still run up to *catch-up window* hours late (default 3) after an outage; after that it is recorded as **Missed** and can be retried by an administrator.
- **Safety net:** if the host scheduler stops calling, a due slot is also picked up the next time anyone opens the app (at most every 10 minutes, after the page is sent). The System Monitor warns when the host scheduler has been silent for 8 hours.
- **Security:** Vercel Cron bypasses deployment protection. Optionally add a `CRON_SECRET` environment variable (Production) — Vercel then sends it and the endpoint requires it.
- **Check it is registered:** Vercel → asgard-qc → Settings → Cron Jobs should list six jobs for `/api/cron/system-review`. You can trigger one with *Run* there; it only runs a slot that is due.
- **Other hosting:** call `GET /api/cron/system-review` at the same six UTC times with any scheduler (cron, systemd timer, GitHub Actions), sending `Authorization: Bearer <CRON_SECRET>` if set.

## Emailing review reports (Microsoft 365)

Nothing is emailed until all of the following are in place:

1. In the Microsoft Entra admin centre, open **App registrations → New registration** (single tenant). Under **API permissions**, add **Microsoft Graph → Application → Mail.Send**, then click **Grant admin consent**. Under **Certificates & secrets**, create a client secret.
2. Recommended: limit the app to a single mailbox (for example `quality@asgardmm.com`) using an Exchange Online application access policy, so it cannot send as anyone else.
3. Add these server environment variables in Vercel (Production only): `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET` and `M365_SENDER` (the sender mailbox). Optionally add `APP_URL=https://asgard-qc.vercel.app` so emails link to the report. Then redeploy.
4. In **System Monitor → Settings**, an administrator ticks **Also email reports**.

Reports go to the selected report recipients and to administrators. The same "only when there are new issues" rule applies to email as to in-app notifications. Each run records the provider's answer. "Accepted by Microsoft 365" means Exchange took the message; it is not proof of delivery. The secret is used only on the server.
