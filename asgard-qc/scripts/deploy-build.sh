#!/usr/bin/env bash
# Hosted build (Netlify or Vercel): apply committed Prisma migrations to the
# managed database, create the first admin (and demo data if requested),
# then build Next.js.
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-${NETLIFY_DB_URL:-${POSTGRES_PRISMA_URL:-}}}"
npx prisma generate
if [ -n "$DATABASE_URL" ]; then
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
    if [ -n "${ITP_APPLY:-}" ] && [ -n "${ITP_ROWS:-}" ]; then
      npm run db:apply-itp
    fi
    if [ "${PURGE_DEMO_DATA:-}" = "true" ]; then
      # Removes only records flagged as demo; refuses if real records depend on them.
      npm run db:purge-demo -- --yes
    fi
  else
    echo "ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping first-admin seed."
  fi
else
  echo "WARNING: no DATABASE_URL in the build — migrations not applied."
fi
npx next build
