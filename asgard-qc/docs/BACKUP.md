# Backup and recovery

What must be backed up:
1. **PostgreSQL database** — all records, audit trail, settings.
2. **File storage** — original photos, thumbnails, document revisions, generated PDFs (`STORAGE_DIR`, or the S3 bucket).

## Backup

```bash
cd asgard-qc
npm run backup                         # → ./backups/<UTC timestamp>/
BACKUP_DIR=/mnt/backup-share npm run backup
```

Produces `database.dump` (pg_dump custom format), `storage.tar.gz` (local storage only) and `SHA256SUMS`.
Schedule it (cron/Task Scheduler) at least daily and copy the folder off the server. For S3 storage enable bucket versioning and cross-region replication instead.
Also back up the `.env` file securely (it holds the database password and keys) — not alongside the data.

## Restore (tested)

```bash
createdb -O asgard asgard_qc_restored
pg_restore --no-owner -d "postgresql://asgard:…@host:5432/asgard_qc_restored" backups/<stamp>/database.dump
tar -xzf backups/<stamp>/storage.tar.gz -C <parent of STORAGE_DIR>
sha256sum -c backups/<stamp>/SHA256SUMS      # run inside the backup folder before restoring
```

Point `DATABASE_URL` at the restored database and restart. This procedure was verified in development: a dump was restored into a fresh database and the photo/inspection counts and all evidence files matched.

Integrity: every photo and document revision stores a SHA-256 of the original file, exported in the photo evidence index, so restored files can be checked against the records.
Hosted Postgres (Neon, RDS, Azure) also provides point-in-time recovery — turn it on.
