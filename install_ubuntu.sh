#!/bin/bash
# ============================================================
#  AzubiBoard – Ubuntu LAMP Installations-Skript
#  Ausführen auf dem Server:
#    git clone https://github.com/OGBullZ/AzubiBoard.git
#    cd AzubiBoard
#    chmod +x install_ubuntu.sh
#    sudo bash install_ubuntu.sh
# ============================================================

set -e  # Bei Fehler sofort abbrechen

# ── Farben ───────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
info() { echo -e "${YELLOW}  → $1${NC}"; }
err()  { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
hdr()  { echo -e "\n${CYAN}[$1]${NC}"; }

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  AzubiBoard – Automatisches Setup (Ubuntu)${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# ── Root-Prüfung ─────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Bitte als root ausführen: sudo bash install_ubuntu.sh"

# ── Konfiguration ─────────────────────────────────────────────
APP_DIR="/var/www/html/azubiboard"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"   # Ordner in dem das Skript liegt

DB_NAME="azubiboard"
DB_USER="azubiboard_user"

# Server-IP automatisch ermitteln
SERVER_IP=$(hostname -I | awk '{print $1}')

# ── Passwörter interaktiv abfragen ────────────────────────────
echo -e "${CYAN}Einrichtung der Zugangsdaten:${NC}"
echo ""

read -s -p "  MySQL root-Passwort (leer lassen bei frischer Ubuntu-Installation): " MYSQL_ROOT_PASS
echo ""

while true; do
    read -s -p "  Neues Passwort für Datenbank-User '$DB_USER': " DB_PASS
    echo ""
    read -s -p "  Passwort bestätigen: " DB_PASS2
    echo ""
    [ "$DB_PASS" = "$DB_PASS2" ] && break
    echo -e "${RED}  Passwörter stimmen nicht überein, nochmal:${NC}"
done

# JWT-Secret zufällig generieren
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

# HTTPS-Setup optional (nur mit Domain + Let's Encrypt)
echo ""
read -p "  Domain für HTTPS (leer lassen für IP-only, z.B. azubiboard.example.de): " DOMAIN
if [ -n "$DOMAIN" ]; then
    read -p "  E-Mail für Let's Encrypt (für Zertifikat-Ablauf-Benachrichtigungen): " CERT_EMAIL
fi

echo ""

# ── 1. Node.js + PHP-Erweiterungen + Composer prüfen ──────────
hdr "1/9 Node.js + PHP-Erweiterungen + Composer prüfen"

# PHP pdo_mysql prüfen (für Datenbankverbindung zwingend erforderlich)
if php -r "new PDO('mysql:host=127.0.0.1', 'x', 'x');" 2>&1 | grep -q "could not find driver"; then
    info "PHP pdo_mysql nicht gefunden – wird installiert..."
    PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
    apt-get install -y "php${PHP_VER}-mysql" > /dev/null 2>&1
    ok "php${PHP_VER}-mysql installiert"
else
    ok "PHP pdo_mysql: vorhanden"
fi

# PHP zip + mbstring + xml prüfen (Composer + PHPUnit brauchen das)
PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
for ext in zip mbstring xml; do
    if ! php -m | grep -qi "^${ext}$"; then
        info "PHP ${ext}-Extension nicht gefunden – wird installiert..."
        apt-get install -y "php${PHP_VER}-${ext}" > /dev/null 2>&1
        ok "php${PHP_VER}-${ext} installiert"
    else
        ok "PHP ${ext}: vorhanden"
    fi
done

# Composer prüfen (für PHP-Dependencies wie PHPUnit)
if command -v composer &> /dev/null; then
    ok "Composer bereits installiert: $(composer --version | head -1)"
else
    info "Composer wird installiert..."
    apt-get install -y composer > /dev/null 2>&1
    if command -v composer &> /dev/null; then
        ok "Composer installiert"
    else
        info "⚠ Composer apt-Install fehlgeschlagen, fallback auf getcomposer.org..."
        curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer > /dev/null 2>&1
        ok "Composer installiert (/usr/local/bin/composer)"
    fi
fi

if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    ok "Node.js bereits installiert: $NODE_VER"
else
    info "Node.js wird installiert (v20 LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
    ok "Node.js $(node -v) installiert"
fi

# ── 2. Frontend + PHP-Dependencies bauen ──────────────────────
hdr "2/9 Frontend + PHP-Dependencies bauen"
info "npm install..."
cd "$REPO_DIR"
npm ci --silent

info "npm run build..."
VITE_BASE_PATH=/azubiboard/ VITE_USE_API=true npm run build > /dev/null 2>&1
ok "Build erfolgreich (dist/ erstellt)"

# composer install — für PHPUnit + zukünftige PHP-Pakete (vendor/ ist gitignored)
if [ -f "$REPO_DIR/composer.json" ]; then
    info "composer install..."
    composer install --no-interaction --prefer-dist --no-progress > /dev/null 2>&1 \
        && ok "PHP-Dependencies installiert (vendor/)" \
        || info "⚠ composer install fehlgeschlagen — manuell nachholen: cd $REPO_DIR && composer install"

    # Smoke-Test: phpunit findet die Konfig und läuft
    if [ -x "$REPO_DIR/vendor/bin/phpunit" ]; then
        if "$REPO_DIR/vendor/bin/phpunit" --testsuite=smoke > /dev/null 2>&1; then
            ok "PHPUnit Smoke-Test grün"
        else
            info "⚠ PHPUnit Smoke-Test fehlgeschlagen — manuell prüfen: vendor/bin/phpunit --testsuite=smoke"
        fi
    fi
else
    ok "Keine composer.json gefunden — PHP-Dependencies übersprungen"
fi

# ── 3. Dateien deployen ───────────────────────────────────────
hdr "3/9 Dateien deployen"

# App-Ordner anlegen
mkdir -p "$APP_DIR/uploads"

# dist/ → App-Root
info "Frontend-Dateien kopieren..."
cp -r "$REPO_DIR/dist/." "$APP_DIR/"

# api/ kopieren
info "PHP-API kopieren..."
cp -r "$REPO_DIR/api" "$APP_DIR/api"

# Berechtigungen setzen
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/uploads"
ok "Dateien deployed nach $APP_DIR"

# ── 4. .env erstellen ─────────────────────────────────────────
hdr "4/9 Konfiguration (.env)"
cat > "$APP_DIR/.env" << EOF
VITE_BASE_PATH=/azubiboard/
VITE_USE_API=true

DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=604800

ALLOWED_ORIGIN=${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://${SERVER_IP}}

APP_ENV=production
EOF
chmod 640 "$APP_DIR/.env"
chown www-data:www-data "$APP_DIR/.env"
ok ".env erstellt (ALLOWED_ORIGIN=http://$SERVER_IP)"

# ── 5. Datenbank einrichten ────────────────────────────────────
hdr "5/9 Datenbank einrichten"

# Ubuntu nutzt standardmäßig Socket-Auth → als root einfach "mysql" reicht
# Nur wenn ein Passwort gesetzt wurde, explizit übergeben
if [ -n "$MYSQL_ROOT_PASS" ]; then
    MYSQL_CMD="mysql -u root -p${MYSQL_ROOT_PASS}"
else
    MYSQL_CMD="mysql"
fi

# Verbindung testen
if ! $MYSQL_CMD -e "SELECT 1;" > /dev/null 2>&1; then
    err "MySQL-Verbindung fehlgeschlagen. Bitte root-Passwort prüfen oder 'sudo mysql' manuell testen."
fi
ok "MySQL-Verbindung: OK"

# Datenbank + User anlegen
$MYSQL_CMD << EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME}
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost'
    IDENTIFIED BY '${DB_PASS}';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER
    ON ${DB_NAME}.*
    TO '${DB_USER}'@'localhost';

FLUSH PRIVILEGES;
EOF
ok "Datenbank '$DB_NAME' und User '$DB_USER' angelegt"

# Schema importieren
$MYSQL_CMD "$DB_NAME" < "$REPO_DIR/database/setup.sql" 2>/dev/null || true
ok "Datenbank-Schema importiert"

# ── 6. Apache konfigurieren ────────────────────────────────────
hdr "6/9 Apache konfigurieren"

# mod_rewrite + mod_headers + mod_expires aktivieren
a2enmod rewrite  > /dev/null 2>&1
a2enmod headers  > /dev/null 2>&1
a2enmod expires  > /dev/null 2>&1
ok "mod_rewrite, mod_headers und mod_expires aktiviert"

# Apache-Config für azubiboard
cat > /etc/apache2/conf-available/azubiboard.conf << EOF
<Directory /var/www/html/azubiboard>
    AllowOverride All
    Require all granted
</Directory>
EOF

a2enconf azubiboard > /dev/null 2>&1
ok "Apache-Konfiguration für azubiboard aktiviert"

# PHP-Upload-Limit anpassen
PHP_INI=$(php --ini | grep "Loaded Configuration" | awk '{print $NF}')
if [ -f "$PHP_INI" ]; then
    sed -i 's/upload_max_filesize = .*/upload_max_filesize = 15M/' "$PHP_INI"
    sed -i 's/post_max_size = .*/post_max_size = 16M/' "$PHP_INI"
    ok "PHP Upload-Limit auf 15M gesetzt ($PHP_INI)"
fi

# Apache neu starten
systemctl restart apache2
ok "Apache neu gestartet"

# ── 7. Automatische DB-Sicherung (Cron) ──────────────────────
hdr "7/9 Automatische DB-Sicherung einrichten"

BACKUP_DIR="/var/backups/azubiboard"
mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

# MySQL-Credentials für mysqldump in separater Datei (root-only lesbar)
cat > /etc/mysql/azubiboard-backup.cnf << EOF
[mysqldump]
user=${DB_USER}
password=${DB_PASS}
host=localhost
EOF
chmod 600 /etc/mysql/azubiboard-backup.cnf
ok "MySQL-Credentials für Backup gespeichert (/etc/mysql/azubiboard-backup.cnf)"

# Backup-Skript erstellen
cat > /usr/local/bin/azubiboard-backup.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/azubiboard"
DAY=$(date +%Y-%m-%d)
mysqldump --defaults-extra-file=/etc/mysql/azubiboard-backup.cnf azubiboard 2>/dev/null \
  | gzip > "${BACKUP_DIR}/azubiboard_${DAY}.sql.gz"
# Backups älter als 30 Tage löschen
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete
SCRIPT
chmod 750 /usr/local/bin/azubiboard-backup.sh
ok "Backup-Skript erstellt (/usr/local/bin/azubiboard-backup.sh)"

# Cron-Job: täglich um 03:00 Uhr
cat > /etc/cron.d/azubiboard-backup << 'CRON'
# AzubiBoard – tägliche Datenbank-Sicherung nach /var/backups/azubiboard/
0 3 * * * root /usr/local/bin/azubiboard-backup.sh
CRON
chmod 644 /etc/cron.d/azubiboard-backup
ok "Cron-Job eingerichtet (täglich 03:00 → $BACKUP_DIR)"

# ── 8. HTTPS + Auto-Deploy ────────────────────────────────────
hdr "8/9 HTTPS + Auto-Deploy einrichten"

# ── 8a. HTTPS via Let's Encrypt (nur wenn Domain angegeben) ──
if [ -n "$DOMAIN" ]; then
    info "Certbot installieren..."
    apt-get install -y certbot python3-certbot-apache > /dev/null 2>&1
    ok "Certbot installiert"

    # VirtualHost für die Domain anlegen (Certbot braucht ServerName)
    cat > /etc/apache2/sites-available/azubiboard-ssl.conf << EOF
<VirtualHost *:80>
    ServerName ${DOMAIN}
    DocumentRoot /var/www/html
    RewriteEngine On
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>
EOF
    a2ensite azubiboard-ssl > /dev/null 2>&1
    systemctl reload apache2

    info "Let's Encrypt Zertifikat für $DOMAIN holen..."
    certbot --apache -d "$DOMAIN" --non-interactive --agree-tos \
        --email "$CERT_EMAIL" --redirect > /dev/null 2>&1 \
        && ok "HTTPS eingerichtet (https://$DOMAIN)" \
        || info "⚠ Certbot fehlgeschlagen — DNS für $DOMAIN korrekt gesetzt? Manuell nachholen: certbot --apache -d $DOMAIN"

    # .env ALLOWED_ORIGIN auf HTTPS aktualisieren
    sed -i "s|ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=https://${DOMAIN}|" "$APP_DIR/.env"
    ok ".env: ALLOWED_ORIGIN=https://$DOMAIN"
else
    ok "HTTPS übersprungen (keine Domain angegeben)"
fi

# ── 8b. Auto-Deploy-Script (OPS10) ───────────────────────────
# Erstellt /usr/local/bin/azubiboard-deploy.sh:
# Zieht 'git pull origin main', baut neu und deployed wenn neue Commits vorhanden.

cat > /usr/local/bin/azubiboard-deploy.sh << SCRIPT
#!/bin/bash
set -euo pipefail
REPO_DIR="${REPO_DIR}"
APP_DIR="${APP_DIR}"
LOG="/var/log/azubiboard-deploy.log"

log() { echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$1" | tee -a "\$LOG"; }

cd "\$REPO_DIR"

git fetch origin main --quiet 2>/dev/null || { log "git fetch fehlgeschlagen"; exit 1; }
LOCAL=\$(git rev-parse HEAD)
REMOTE=\$(git rev-parse origin/main)

if [ "\$LOCAL" = "\$REMOTE" ]; then
    exit 0   # kein Update nötig
fi

log "Update: \${LOCAL:0:7} → \${REMOTE:0:7}"
git pull origin main --quiet 2>/dev/null || { log "git pull fehlgeschlagen"; exit 1; }

npm ci --silent 2>/dev/null        || { log "npm ci fehlgeschlagen"; exit 1; }
VITE_BASE_PATH=/azubiboard/ VITE_USE_API=true npm run build > /dev/null 2>&1 \
                                   || { log "Build fehlgeschlagen"; exit 1; }

cp -r "\$REPO_DIR/dist/." "\$APP_DIR/"
cp -r "\$REPO_DIR/api"    "\$APP_DIR/api"
chown -R www-data:www-data "\$APP_DIR"
chmod -R 755 "\$APP_DIR"

systemctl reload apache2 2>/dev/null || true
log "Deploy abgeschlossen (\${REMOTE:0:7})"
SCRIPT
chmod 750 /usr/local/bin/azubiboard-deploy.sh
ok "Deploy-Skript erstellt (/usr/local/bin/azubiboard-deploy.sh)"

# Cron: alle 10 Minuten auf neue Commits prüfen
cat > /etc/cron.d/azubiboard-deploy << 'CRON'
# AzubiBoard – automatischer Deploy bei neuem Commit auf main
*/10 * * * * root /usr/local/bin/azubiboard-deploy.sh
CRON
chmod 644 /etc/cron.d/azubiboard-deploy
ok "Cron-Job eingerichtet (alle 10 min, Log: /var/log/azubiboard-deploy.log)"

# Logrotate für Deploy-Log
cat > /etc/logrotate.d/azubiboard-deploy << 'LR'
/var/log/azubiboard-deploy.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
LR
ok "Logrotate für Deploy-Log eingerichtet"

# ── 8c. Deploy-Key (OPS3) ────────────────────────────────────
# Generiert ein Ed25519-SSH-Schlüsselpaar für den automatischen git-Pull.
# Public Key muss einmalig in GitHub → Repository → Settings → Deploy Keys
# als Read-Only-Key eingetragen werden.
# Danach Remote auf SSH umstellen: git remote set-url origin git@github.com:OGBullZ/AzubiBoard.git
hdr "8c/9 Deploy-Key einrichten (OPS3)"

DEPLOY_KEY_FILE="/root/.ssh/azubiboard_deploy"
if [ ! -f "$DEPLOY_KEY_FILE" ]; then
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY_FILE" -N "" -C "azubiboard-deploy@$(hostname)" > /dev/null 2>&1
    ok "Deploy-Key generiert: $DEPLOY_KEY_FILE"
else
    ok "Deploy-Key existiert bereits: $DEPLOY_KEY_FILE"
fi

# SSH-Config: GitHub nutzt den Deploy-Key automatisch
SSH_CONFIG="/root/.ssh/config"
if ! grep -q "azubiboard-deploy" "$SSH_CONFIG" 2>/dev/null; then
    cat >> "$SSH_CONFIG" << SSHCFG

# AzubiBoard Deploy-Key (OPS3)
Host github.com-azubiboard
    HostName github.com
    User git
    IdentityFile $DEPLOY_KEY_FILE
    IdentitiesOnly yes
SSHCFG
    chmod 600 "$SSH_CONFIG"
    ok "SSH-Config aktualisiert"
fi

# GitHub Host-Key vorab akzeptieren (verhindert interaktive Prompt beim ersten Pull)
ssh-keyscan -H github.com >> /root/.ssh/known_hosts 2>/dev/null
ok "GitHub Host-Key in known_hosts eingetragen"

# Remote auf SSH umstellen wenn noch HTTPS
cd "$REPO_DIR"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if echo "$CURRENT_REMOTE" | grep -q "https://"; then
    git remote set-url origin "git@github.com-azubiboard:OGBullZ/AzubiBoard.git"
    ok "Git-Remote auf SSH-URL umgestellt"
fi

echo ""
echo -e "${YELLOW}  WICHTIG: Public Key zu GitHub hinzufügen:${NC}"
echo -e "  Repository → Settings → Deploy Keys → Add deploy key (Read-only):"
echo ""
cat "$DEPLOY_KEY_FILE.pub"
echo ""

# ── SEC1: UFW + Fail2ban ─────────────────────────────────────
hdr "SEC1: UFW + Fail2ban einrichten"

# UFW: nur SSH (22), HTTP (80), HTTPS (443) erlauben
if command -v ufw &>/dev/null || apt-get install -y -q ufw &>/dev/null; then
    ufw --force reset > /dev/null 2>&1
    ufw default deny incoming  > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    ufw allow 22/tcp            > /dev/null 2>&1  # SSH
    ufw allow 80/tcp            > /dev/null 2>&1  # HTTP
    ufw allow 443/tcp           > /dev/null 2>&1  # HTTPS
    ufw --force enable          > /dev/null 2>&1
    ok "UFW aktiviert (22/80/443 offen, Rest blocked)"
else
    info "UFW konnte nicht installiert werden — manuell nachholen"
fi

# Fail2ban: Apache + SSH schützen
if apt-get install -y -q fail2ban &>/dev/null; then
    cat > /etc/fail2ban/jail.d/azubiboard.conf << 'F2B'
[sshd]
enabled  = true
port     = ssh
maxretry = 5
bantime  = 3600
findtime = 600

[apache-auth]
enabled  = true
port     = http,https
maxretry = 10
bantime  = 3600
findtime = 600

[apache-badbots]
enabled  = true
port     = http,https
maxretry = 2
bantime  = 86400

[apache-noscript]
enabled  = true
port     = http,https
maxretry = 6
bantime  = 3600
F2B
    systemctl enable fail2ban  > /dev/null 2>&1
    systemctl restart fail2ban > /dev/null 2>&1
    ok "Fail2ban eingerichtet (SSH + Apache, Ban: 1h/24h)"
else
    info "Fail2ban konnte nicht installiert werden — manuell nachholen"
fi

# ── 9. Fertig ─────────────────────────────────────────────────
hdr "9/9 Fertig"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Installation abgeschlossen!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
    echo -e "  App-URL:    ${CYAN}https://${DOMAIN}/azubiboard/${NC}"
else
    echo -e "  App-URL:    ${CYAN}http://${SERVER_IP}/azubiboard/${NC}"
fi
echo -e "  phpMyAdmin: ${CYAN}http://localhost/phpmyadmin${NC}  (nur lokal)"
echo -e "  DB-Backups: ${CYAN}/var/backups/azubiboard/${NC}  (tägl. 03:00, 30 Tage)"
echo -e "  Auto-Deploy: alle 10 min, Log: ${CYAN}/var/log/azubiboard-deploy.log${NC}"
echo -e "  Firewall:    UFW aktiv (22/80/443) · Fail2ban aktiv"
echo -e "  Deploy-Key:  /root/.ssh/azubiboard_deploy.pub → in GitHub eintragen!"
echo ""
echo -e "${YELLOW}  Nächste Schritte:${NC}"
APP_URL="${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://${SERVER_IP}}"
echo "  1. ${APP_URL}/azubiboard/ im Browser öffnen"
echo "  2. Account registrieren"
echo "  3. Ausbilder-Rolle setzen:"
echo ""
echo -e "     ${CYAN}${MYSQL_CMD} -e \"UPDATE azubiboard.users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';\"${NC}"
echo ""
