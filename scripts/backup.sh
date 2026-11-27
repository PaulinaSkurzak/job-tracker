#!/usr/bin/env bash
# Save a copy of the database to backups/jobtracker-<date>-<time>.dump and keep the newest 14.
#   ./scripts/backup.sh
# Restore one with ./scripts/restore.sh <file>. backups/ holds your personal data and is gitignored.
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP=14
mkdir -p backups
file="backups/jobtracker-$(date +%Y%m%d-%H%M%S).dump"

# pg_dump runs inside the db container, which already has the database name and user from .env.
# --format=custom is compressed and lets pg_restore restore selectively. Write to a temp file first so a
# failed dump never leaves a half-written file that looks like a good backup.
docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$file.partial"
mv "$file.partial" "$file"

# Check the file is a readable backup, not just bytes.
docker compose exec -T db pg_restore --list < "$file" > /dev/null

echo "Saved $file ($(du -h "$file" | cut -f1))"

# Keep only the newest $KEEP backups.
ls -1t backups/jobtracker-*.dump | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -- "$old"
  echo "Removed old backup $old"
done
