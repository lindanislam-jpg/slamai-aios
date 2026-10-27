#!/usr/bin/env bash
# Netlify build: apply committed Prisma migrations to the managed database,
# create the first admin (and demo data if requested), then build Next.js.
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-${NETLIFY_DB_URL:-}}"
npx prisma generate
if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
  if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    # Builds cannot write to Netlify Blobs; demo photos are added in-app
    # (Settings → Data). The seed skips anything that already exists.
    SEED_DEMO_PHOTOS=false npm run db:seed
  else
    echo "ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping first-admin seed."
  fi
else
  echo "WARNING: no DATABASE_URL or NETLIFY_DB_URL in the build — migrations not applied."
fi
npx next build
