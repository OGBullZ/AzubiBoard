#!/bin/bash
set -e

# Absoluter Pfad zum Repo auf dem Server
REPO_DIR="/var/www/AzubiBoard"
# Zielverzeichnis für den Webserver
WEB_DIR="/var/www/html/AzubiBoard"
LOG="/var/log/azubiboard-deploy.log"

cd "$REPO_DIR"

git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0  # Kein neuer Commit – nichts zu tun
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Neuer Commit erkannt: $REMOTE" >> "$LOG"

git pull origin main
npm ci --prefer-offline
npm run build

# dist/ per Symlink ins Webroot (atomarer Wechsel, kein Downtime)
ln -snf "$REPO_DIR/dist" "$WEB_DIR"

rsync -a api/ "$WEB_DIR/api/"

# .htaccess fuer SPA-Routing sicherstellen
cp .htaccess "$WEB_DIR/.htaccess"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy OK" >> "$LOG"
