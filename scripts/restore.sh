#!/usr/bin/env bash
# Replace the current database with a backup made by scripts/backup.sh.
#   ./scripts/restore.sh backups/jobtracker-20261127-090000.dump
set -euo pipefail
cd "$(dirname "$0")/.."

file="${1:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "Usage: $0 backups/<file>.dump" >&2
  ls -1t backups/*.dump 2>/dev/null | head -5 | sed 's/^/  /' >&2
  exit 1
fi

docker compose exec -T db pg_restore --list < "$file" > /dev/null  # refuse a file that isn't a backup

read -r -p "This replaces ALL current data with $file. Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "Cancelled."; exit 1; }

# Take a safety backup first, so a restore can itself be undone.
./scripts/backup.sh

# Stop the app so nothing writes while the data is replaced, and start it again however this ends.
docker compose stop web
trap 'docker compose start web > /dev/null' EXIT
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$file"
echo "Restored $file."
