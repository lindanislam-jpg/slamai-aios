#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip this build, exit 1 = build it.
# Preview deployments share the Neon database and Blob store with production
# unless they have their own, so they are not built at all until an
# administrator has set up an isolated preview database (see docs/DEPLOYMENT.md)
# and set PREVIEW_DB_ISOLATED=true for the Preview environment.
if [ "${VERCEL_ENV:-}" = "production" ] || [ "${PREVIEW_DB_ISOLATED:-}" = "true" ]; then
  echo "Building (${VERCEL_ENV:-unknown} environment)."
  exit 1
fi
echo "Skipping ${VERCEL_ENV:-non-production} build: previews have no separate database yet."
exit 0
