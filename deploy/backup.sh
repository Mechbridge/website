#!/usr/bin/env bash
# Nightly backup of the database and CV uploads. Cron: 15 2 * * * /var/www/mechbridge/deploy/backup.sh
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/mechbridge}"
DEST="${BACKUP_DIR:-/var/backups/mechbridge}"
STAMP="$(date +%F)"
mkdir -p "$DEST"
# Consistent copy of a live SQLite database
sqlite3 "$DATA_DIR/mechbridge.db" ".backup '$DEST/mechbridge-$STAMP.db'"
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
# Keep 30 days
find "$DEST" -type f -mtime +30 -delete
