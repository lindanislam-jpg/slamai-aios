#!/usr/bin/env bash
# Hosted build (Netlify or Vercel): apply committed Prisma migrations to the
# managed database, create the first admin (and demo data if requested),
# then build Next.js.
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-${NETLIFY_DB_URL:-${POSTGRES_PRISMA_URL:-}}}"
npx prisma generate
# Only a production build may change the database. Vercel previews share the
# production database unless an isolated one was configured
# (PREVIEW_DB_ISOLATED=true), so they get no migrations, seed or data steps.
db_writes=true
if [ -n "${VERCEL_ENV:-}" ] && [ "${VERCEL_ENV}" != "production" ] && [ "${PREVIEW_DB_ISOLATED:-}" != "true" ]; then
  db_writes=false
  echo "Non-production build (${VERCEL_ENV}) without an isolated database — skipping migrations and data steps."
fi
if [ -n "$DATABASE_URL" ] && [ "$db_writes" = "true" ]; then
  # Migrations need a direct (unpooled) connection when the provider offers one (Neon on Vercel).
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy
  if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    # Netlify builds cannot write to Blobs, so demo photos are added in-app
    # there (Settings → Data). Vercel builds can write to a connected Blob
    # store. The seed skips anything that already exists.
    photos=false
    if [ -n "${VERCEL:-}" ] && [ -n "${BLOB_READ_WRITE_TOKEN:-}" ]; then photos="${SEED_DEMO_PHOTOS:-true}"; fi
    SEED_DEMO_PHOTOS="$photos" npm run db:seed
    if [ -n "${USER_CREATE:-}${USER_ROLE_UPDATES:-}" ]; then
      npm run db:create-users
    fi
    if [ -n "${PROJECT_IMPORT_ROWS:-}" ]; then
      npm run db:import-projects
    fi
    if [ -n "${PROJECT_STATUS_UPDATES:-}${PROJECT_FIELD_UPDATES:-}" ]; then
      npm run db:set-project-status
    fi
    itp_targets="${ITP_APPLY:-}"; itp_rows="${ITP_ROWS:-}${ITP_ROWS_GZ:-}"
    if [ -n "${itp_targets// /}" ] && [ -n "${itp_rows// /}" ]; then
      npm run db:apply-itp
    fi
    insp_rows="${INSPECTION_IMPORT_GZ:-}"
    if [ -n "${insp_rows// /}" ]; then
      npm run db:import-inspections
    fi
    if [ "${PURGE_DEMO_DATA:-}" = "true" ]; then
      # Removes only records flagged as demo; refuses if real records depend on them.
      npm run db:purge-demo -- --yes
    fi
  else
    echo "ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping first-admin seed."
  fi
elif [ "$db_writes" = "true" ]; then
  echo "WARNING: no DATABASE_URL in the build — migrations not applied."
fi
npx next build
