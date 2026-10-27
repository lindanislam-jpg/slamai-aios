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
| **Vercel / serverless** | Not recommended as-is | No persistent disk → must use S3 storage; large photo batches and PDF generation can hit function time/size limits. |
| **Azure App Service / AWS** with managed Postgres + blob/S3 | Good for cloud | Use S3 driver (Azure Blob needs an S3-compatible gateway or a new driver). |

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
