#!/usr/bin/env bash
# Back up the database and the evidence/document store.
#   npm run backup                 → ./backups/<timestamp>/
#   BACKUP_DIR=/mnt/nas npm run backup
# Restore: see docs/BACKUP.md. Run from the asgard-qc directory.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is not set}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR:-./backups}/$STAMP"
mkdir -p "$DEST"
# pg_dump does not understand Prisma's ?schema= parameter.
PGURL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --file "$DEST/database.dump" "$PGURL"
if [ "${STORAGE_DRIVER:-local}" = "local" ]; then
  tar -czf "$DEST/storage.tar.gz" -C "$(dirname "${STORAGE_DIR:-./storage}")" "$(basename "${STORAGE_DIR:-./storage}")"
else
  echo "STORAGE_DRIVER=$STORAGE_DRIVER — back up the bucket with your provider's versioning/replication." > "$DEST/STORAGE-NOT-INCLUDED.txt"
fi
( cd "$DEST" && sha256sum * > SHA256SUMS )
echo "Backup written to $DEST"
