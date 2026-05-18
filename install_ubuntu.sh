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

echo ""

# ── 1. Node.js + PHP-MySQL-Erweiterung prüfen ─────────────────
hdr "1/7 Node.js + PHP-Erweiterungen prüfen"

# PHP pdo_mysql prüfen (für Datenbankverbindung zwingend erforderlich)
if php -r "new PDO('mysql:host=127.0.0.1', 'x', 'x');" 2>&1 | grep -q "could not find driver"; then
    info "PHP pdo_mysql nicht gefunden – wird installiert..."
    PHP_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
    apt-get install -y "php${PHP_VER}-mysql" > /dev/null 2>&1
    ok "php${PHP_VER}-mysql installiert"
else
    ok "PHP pdo_mysql: vorhanden"
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

# ── 2. Frontend bauen ─────────────────────────────────────────
hdr "2/7 Frontend bauen"
info "npm install..."
cd "$REPO_DIR"
npm ci --silent

info "npm run build..."
VITE_BASE_PATH=/azubiboard/ VITE_USE_API=true npm run build > /dev/null 2>&1
ok "Build erfolgreich (dist/ erstellt)"

# ── 3. Dateien deployen ───────────────────────────────────────
hdr "3/7 Dateien deployen"

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
hdr "4/7 Konfiguration (.env)"
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

ALLOWED_ORIGIN=http://${SERVER_IP}

APP_ENV=production
EOF
chmod 640 "$APP_DIR/.env"
chown www-data:www-data "$APP_DIR/.env"
ok ".env erstellt (ALLOWED_ORIGIN=http://$SERVER_IP)"

# ── 5. Datenbank einrichten ────────────────────────────────────
hdr "5/7 Datenbank einrichten"

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
hdr "6/7 Apache konfigurieren"

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

# ── 7. Fertig ─────────────────────────────────────────────────
hdr "7/7 Fertig"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Installation abgeschlossen!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "  App-URL:    ${CYAN}http://${SERVER_IP}/azubiboard/${NC}"
echo -e "  phpMyAdmin: ${CYAN}http://localhost/phpmyadmin${NC}  (nur lokal)"
echo ""
echo -e "${YELLOW}  Nächste Schritte:${NC}"
echo "  1. http://${SERVER_IP}/azubiboard/ im Browser öffnen"
echo "  2. Account registrieren"
echo "  3. Ausbilder-Rolle setzen:"
echo ""
echo -e "     ${CYAN}${MYSQL_CMD} -e \"UPDATE azubiboard.users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';\"${NC}"
echo ""
