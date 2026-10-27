# ASGARD Quality Command Centre

Internal quality management application for **ASGARD Modular Manufacturing — Quality Department**.
It follows each project from commencement through fabrication, welding, inspection, repair and final release, using real records and photographic evidence, and produces traceable PDF quality reports and Excel exports.

> This is a self-contained app inside the `slamai-aios` repository. It shares no code, database or users with SlamAI AIOS. Moving it to its own repository is recommended (see docs/DEPLOYMENT.md).

## Quick start (local)

Requirements: Node.js 20+ (22 recommended), PostgreSQL 14+.

```bash
cd asgard-qc
npm install
cp .env.example .env          # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate deploy      # create tables
npm run db:seed                # create the first administrator (+ demo data if SEED_DEMO_DATA=true)
npm run dev                    # http://localhost:3010
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on http://localhost:3010 |
| `npm run build && npm start` | Production build and server (port 3010) |
| `npm test` | Unit + integration tests (needs a database named `*test*`, see `.env.example`) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:seed` | First admin + optional DEMO data |
| `npm run db:purge-demo` | Delete all records flagged DEMO (and their files) |
| `npm run notifications:run` | Refresh in-app reminders (schedule e.g. every 15 min) |
| `npm run backup` | Database dump + evidence archive (see docs/BACKUP.md) |

## Documentation

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md) — for QC inspectors and Quality Managers
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — setup, configuration, deployment options
- [docs/BACKUP.md](docs/BACKUP.md) — backup and recovery
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — QMS / SharePoint, AI vision, storage, email
- [docs/KPI-DEFINITIONS.md](docs/KPI-DEFINITIONS.md) — how every dashboard number is calculated
- [docs/STATUS.md](docs/STATUS.md) — what is complete, what needs company data, credentials or approval
- [docs/PILOT.md](docs/PILOT.md) — two-week pilot plan with go / no-go criteria

## Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind** — server-rendered pages, server actions for forms, route handlers for uploads/downloads/exports.
- **PostgreSQL + Prisma** — ~30 tables with foreign keys, indexes and migrations in `prisma/migrations`.
- **Service layer** (`src/lib/services/*`) — every business rule and permission check lives here, so the UI, API routes, seed and tests share one implementation. Every change writes an `AuditEvent` in the same transaction.
- **File storage** (`src/lib/storage`) — local disk (default) or any S3-compatible bucket. Originals are stored byte-for-byte with a SHA-256 fingerprint; thumbnails are derived copies.
- **PDF** — pdfkit (`src/lib/report`). **Excel** — exceljs (`src/lib/export`). **Images** — sharp + exifr.
- **Auth** — email/password, bcrypt, server-side sessions (only the token hash is stored), lockout after 5 failures, role-based permissions configurable in Settings.

## Ground rules built into the software

- Prototype/synthetic records are flagged `isDemo` and labelled **DEMO** everywhere (UI, exports, PDF watermark).
- No acceptance criteria, tolerances, standards or certificate data are hard-coded. Missing criteria are flagged *Requires configuration*.
- Capture time comes only from a photo's own EXIF data; it is never back-filled from upload time.
- AI suggestions are drafts. They cannot confirm defects, accept material, close NCRs or release product.
- An NCR closes only through verification by an authorised user; a repair photo alone changes nothing.
- Release is blocked while configured checks fail, unless an authorised Quality Manager records a documented concession.
- Reports are always marked **DRAFT — NOT APPROVED**; the approval block is left for wet/e-signature.
