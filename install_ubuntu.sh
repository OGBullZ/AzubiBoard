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

# ── Selbstschutz gegen Windows-Zeilenenden ───────────────────
# Kommt das Skript per USB-Stick/Zip von einem Windows-Rechner, hat es CRLF.
# Jedes Heredoc schreibt die \r dann mit — die erzeugten Cron-Skripte
# (/usr/local/bin/azubiboard-*.sh) bekommen "#!/bin/bash\r" und scheitern beim
# Ausführen an "bad interpreter". Deshalb: bereinigte Kopie bauen und die starten.
if grep -q $'\r' "$0" 2>/dev/null; then
    echo -e "${YELLOW}  → Windows-Zeilenenden (CRLF) erkannt — starte bereinigte Kopie...${NC}"
    SELF_CLEAN=$(mktemp /tmp/azubiboard-install.XXXXXX.sh)
    tr -d '\r' < "$0" > "$SELF_CLEAN"
    chmod +x "$SELF_CLEAN"
    exec bash "$SELF_CLEAN" "$@"
fi

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

# Datenbank-Host: leer = MySQL läuft lokal auf diesem Server (Socket-Auth möglich),
# sonst separater DB-Server (z.B. 10.14.99.12) → Netzwerk-Login zwingend.
read -p "  Datenbank-Host (leer = lokal, sonst z.B. 10.14.99.12): " DB_HOST
DB_HOST=${DB_HOST:-localhost}
read -p "  Datenbank-Port [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}

if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
    DB_REMOTE=0
    MYSQL_ADMIN_USER="root"
    read -s -p "  MySQL root-Passwort (leer lassen bei frischer Ubuntu-Installation): " MYSQL_ROOT_PASS
    echo ""
else
    DB_REMOTE=1
    read -p "  Admin-User auf ${DB_HOST} [root]: " MYSQL_ADMIN_USER
    MYSQL_ADMIN_USER=${MYSQL_ADMIN_USER:-root}
    # Bei Remote-DB gibt es keine Socket-Auth — ohne Passwort kommen wir nicht rein
    while [ -z "$MYSQL_ROOT_PASS" ]; do
        read -s -p "  Passwort für ${MYSQL_ADMIN_USER}@${DB_HOST}: " MYSQL_ROOT_PASS
        echo ""
    done
fi

while true; do
    read -s -p "  Neues Passwort für Datenbank-User '$DB_USER': " DB_PASS
    echo ""
    read -s -p "  Passwort bestätigen: " DB_PASS2
    echo ""
    if [ "$DB_PASS" != "$DB_PASS2" ]; then
        echo -e "${RED}  Passwörter stimmen nicht überein, nochmal:${NC}"
        continue
    fi
    if [ -z "$DB_PASS" ]; then
        echo -e "${RED}  Passwort darf nicht leer sein:${NC}"
        continue
    fi
    # Das Passwort landet in SQL-Literalen ('...') und in der .env — Quotes und
    # Backslashes würden beides zerreissen (stiller Login-Fehler nach dem Setup).
    case "$DB_PASS" in
        *\'*|*\\*|*\"*) echo -e "${RED}  Bitte ohne ' \" und \\ — die brechen SQL und .env:${NC}"; continue ;;
    esac
    break
done

# JWT-Secret zufällig generieren
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

# Firewall: nur fragen, wenn UFW noch nicht aktiv ist. Ein Aktivieren kann
# laufende Dienste aussperren — das ist die Entscheidung des Admins, nicht die
# des Installers. Ist UFW bereits aktiv, ergänzen wir nur unsere Ports.
echo ""
if command -v ufw &> /dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    SETUP_UFW="aktiv"
else
    read -p "  Firewall (UFW) jetzt aktivieren? Sperrt alles außer SSH/HTTP/HTTPS [j/N]: " UFW_ANSWER
    case "$UFW_ANSWER" in
        [jJyY]*) SETUP_UFW="ja" ;;
        *)       SETUP_UFW="nein" ;;
    esac
fi

# HTTPS-Setup optional (nur mit Domain + Let's Encrypt)
echo ""
read -p "  Domain für HTTPS (leer lassen für IP-only, z.B. azubiboard.example.de): " DOMAIN
if [ -n "$DOMAIN" ]; then
    read -p "  E-Mail für Let's Encrypt (für Zertifikat-Ablauf-Benachrichtigungen): " CERT_EMAIL
fi

# ── Webserver-Port: der Server ist nicht leer ─────────────────
# Liegt auf Port 80 schon etwas anderes (nginx, ein zweiter Apache, ein
# Container), startet apache2 nicht. Statt daran zu scheitern weichen wir aus —
# fremde Dienste bleiben unangetastet.
WEB_PORT=80
PORT80_HALTER=$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | awk '$4 ~ /:80$/ {print $NF}' | head -1 )
if [ -n "$PORT80_HALTER" ] && ! echo "$PORT80_HALTER" | grep -qi 'apache'; then
    for KANDIDAT in 8080 8081 8088 8000; do
        if ! (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -q ":${KANDIDAT}$"; then
            WEB_PORT=$KANDIDAT
            break
        fi
    done
    if [ "$WEB_PORT" = "80" ]; then
        err "Port 80 ist belegt ($PORT80_HALTER) und 8080/8081/8088/8000 ebenfalls. Bitte einen Port freimachen."
    fi
    info "Port 80 ist belegt ($PORT80_HALTER) — AzubiBoard läuft auf Port ${WEB_PORT}"
    # Die Apache-Dateien werden erst in Schritt 6 angefasst — hier steht evtl.
    # noch gar kein Apache, und ein früher sed liefe ins Leere.
elif [ -n "$PORT80_HALTER" ]; then
    ok "Port 80 wird bereits von Apache bedient"
fi

# Basis-URL einmal zentral: mit Domain HTTPS, sonst IP. Zweistufig, weil die
# Kombi ${DOMAIN:+...}${DOMAIN:-...} bei gesetzter Domain doppelt expandiert
# ("https://foo.defoo.de") und damit CORS/Links kaputt wären.
APP_ORIGIN=${DOMAIN:+https://${DOMAIN}}
if [ "$WEB_PORT" = "80" ]; then
    APP_ORIGIN=${APP_ORIGIN:-http://${SERVER_IP}}
else
    APP_ORIGIN=${APP_ORIGIN:-http://${SERVER_IP}:${WEB_PORT}}
fi

echo ""

# ── 1. Node.js + PHP-Erweiterungen + Composer prüfen ──────────
hdr "1/9 Node.js + PHP-Erweiterungen + Composer prüfen"

# Das Skript läuft als root; Composer fragt dann "Continue as root/super user [yes]?"
# und bekommt vom Skript keine Antwort -> bricht ab -> vendor/ fehlt -> PHPMailer
# fällt still auf mail() zurück. Ohne diese Variable schlägt der Install-Lauf
# reproduzierbar fehl (belegt im Installations-Log vom 24.07.2026).
export COMPOSER_ALLOW_SUPERUSER=1

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

# Vite 7 verlangt Node ^20.19 || >=22.12 (node_modules/vite/package.json).
# Ein vorhandenes, aber zu altes Node (z. B. Ubuntu-22.04-Paket mit v12/v18)
# ließ den Build sonst mit kryptischem Fehler abbrechen.
node_ok() {
    command -v node &> /dev/null || return 1
    local v major minor
    v=$(node -v 2>/dev/null | sed 's/^v//')
    major=${v%%.*}
    minor=$(echo "$v" | cut -d. -f2)
    [ -z "$major" ] && return 1
    if [ "$major" -eq 20 ]; then [ "$minor" -ge 19 ] && return 0 || return 1; fi
    if [ "$major" -ge 22 ]; then
        [ "$major" -gt 22 ] && return 0
        [ "$minor" -ge 12 ] && return 0
    fi
    return 1
}

if node_ok; then
    ok "Node.js bereits installiert: $(node -v)"
else
    if command -v node &> /dev/null; then
        info "Node.js $(node -v) ist zu alt für den Build (nötig: 20.19+ oder 22.12+) — v22 LTS wird installiert..."
    else
        info "Node.js wird installiert (v22 LTS, wie CI)..."
    fi
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /tmp/azubiboard-node.log 2>&1
    apt-get install -y nodejs >> /tmp/azubiboard-node.log 2>&1
    node_ok || err "Node.js 20.19+/22.12+ konnte nicht installiert werden (Log: /tmp/azubiboard-node.log). Ohne passendes Node scheitert der Frontend-Build."
    ok "Node.js $(node -v) installiert"
fi

# ── 2. Frontend + PHP-Dependencies bauen ──────────────────────
hdr "2/9 Frontend + PHP-Dependencies bauen"
info "npm install..."
cd "$REPO_DIR"
# Fehlerausgabe nicht verschlucken: bei set -e bricht das Skript sonst ohne
# jeden Hinweis ab und niemand weiß, ob npm-Registry, Proxy oder Platte schuld war.
if ! npm ci --no-audit --no-fund > /tmp/azubiboard-npm.log 2>&1; then
    info "⚠ npm ci fehlgeschlagen — Fallback auf npm install"
    npm install --no-audit --no-fund >> /tmp/azubiboard-npm.log 2>&1 \
        || err "npm install fehlgeschlagen (Log: /tmp/azubiboard-npm.log). Kein Internet/Proxy auf dem Server? Dann dist/ auf dem Laptop bauen und mitbringen."
fi

info "npm run build..."
if ! VITE_BASE_PATH=/azubiboard/ VITE_USE_API=true npm run build > /tmp/azubiboard-build.log 2>&1 \
   || [ ! -f "$REPO_DIR/dist/index.html" ]; then
    err "Frontend-Build fehlgeschlagen (Log: /tmp/azubiboard-build.log)"
fi
ok "Build erfolgreich (dist/ erstellt)"

# composer install — für PHPUnit + zukünftige PHP-Pakete (vendor/ ist gitignored)
if [ -f "$REPO_DIR/composer.json" ]; then
    info "composer install..."
    if composer install --no-interaction --prefer-dist --no-progress > /tmp/azubiboard-composer.log 2>&1 \
       && [ -f "$REPO_DIR/vendor/autoload.php" ]; then
        ok "PHP-Dependencies installiert (vendor/)"
    else
        # Laut wird's hier, weil ohne vendor/ der SMTP-Versand still auf mail() zurückfällt
        info "⚠ composer install fehlgeschlagen (Log: /tmp/azubiboard-composer.log)"
        info "  → SMTP-Mailversand bleibt inaktiv. Manuell: cd $REPO_DIR && composer install"
    fi

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

# uploads/ enthält nur User-Bilder – Skript-Ausführung hart unterbinden (Polyglot-RCE-Schutz)
cat > "$APP_DIR/uploads/.htaccess" << 'UPHT'
# AzubiBoard: uploads/ enthaelt nur User-Bilder - niemals Skripte ausfuehren/ausliefern
<FilesMatch "\.(php|phtml|php[0-9]|phps|pht|cgi|pl|py|asp|aspx|sh|exe)$">
    Require all denied
</FilesMatch>
RemoveHandler .php .phtml .phps .cgi .pl
UPHT

# dist/ → App-Root
info "Frontend-Dateien kopieren..."
cp -r "$REPO_DIR/dist/." "$APP_DIR/"

# api/ kopieren ('/.' statt Ordner: verhindert api/api-Verschachtelung beim Re-Run)
info "PHP-API kopieren..."
mkdir -p "$APP_DIR/api"
cp -r "$REPO_DIR/api/." "$APP_DIR/api/"

# database/ mitdeployen (Schema + idempotente PHP-Migration; database/.htaccess blockt Web-Zugriff)
info "Datenbank-Skripte kopieren..."
mkdir -p "$APP_DIR/database"
cp -r "$REPO_DIR/database/." "$APP_DIR/database/"

# vendor/ mitdeployen — api/mailer.php sucht APP_DIR/vendor/autoload.php;
# ohne diese Kopie fällt PHPMailer still auf natives mail() zurück (SMTP-Config wirkungslos)
if [ -d "$REPO_DIR/vendor" ]; then
    info "PHP-Dependencies (vendor/) kopieren..."
    mkdir -p "$APP_DIR/vendor"
    cp -r "$REPO_DIR/vendor/." "$APP_DIR/vendor/"
else
    info "⚠ vendor/ fehlt — PHPMailer nicht verfügbar, Mails laufen über natives mail()"
fi

# Berechtigungen setzen
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/uploads"
ok "Dateien deployed nach $APP_DIR"

# ── 4. .env erstellen ─────────────────────────────────────────
hdr "4/9 Konfiguration (.env)"

# Re-Run: bestehendes JWT_SECRET übernehmen (sonst wären alle Sessions ungültig)
# + alte .env sichern (manuell ergänzte Werte wie SMTP/CLAUDE_API_KEY übertragbar);
# .htaccess-Regel "^\.env" blockt auch die Backups vor Web-Zugriff.
if [ -f "$APP_DIR/.env" ]; then
    OLD_JWT=$(grep -oP '^JWT_SECRET=\K.+' "$APP_DIR/.env" || true)
    if [ -n "$OLD_JWT" ]; then
        JWT_SECRET="$OLD_JWT"
        info "Re-Run erkannt: bestehendes JWT_SECRET übernommen (Sessions bleiben gültig)"
    fi
    ENV_BAK="$APP_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
    cp "$APP_DIR/.env" "$ENV_BAK"
    # cp übernimmt die Rechte nicht — das Backup wäre sonst per umask 644 und
    # damit für jeden Nutzer auf dem Server lesbar (DB-Passwort + JWT_SECRET).
    chmod 640 "$ENV_BAK"
    chown www-data:www-data "$ENV_BAK"
    info "Alte .env gesichert — manuell ergänzte Werte (SMTP/CLAUDE_API_KEY) ggf. übertragen"
fi

cat > "$APP_DIR/.env" << EOF
VITE_BASE_PATH=/azubiboard/
VITE_USE_API=true

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=604800

ALLOWED_ORIGIN=${APP_ORIGIN}

APP_ENV=production

# Sprint 12: Dual-Write Blob → relationale Tabellen (für Tier-1-Test auf true)
BACKEND_DUAL_WRITE=false

# N1: SMTP-Versand (leer = Fallback auf native mail())
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_SECURE=tls
# SMTP_FROM=azubiboard@example.de
# SMTP_FROM_NAME=AzubiBoard
# APP_URL=${APP_ORIGIN}/azubiboard   # Link in Digest-Mails

# KI-Features (Sprint 14 AI1-5): Claude-API-Schlüssel eintragen,
# sonst antwortet /api/ai/* mit 503 (Features im UI deaktiviert).
# Holen bei https://console.anthropic.com → API Keys
# CLAUDE_API_KEY=sk-ant-...
EOF
chmod 640 "$APP_DIR/.env"
chown www-data:www-data "$APP_DIR/.env"
ok ".env erstellt (ALLOWED_ORIGIN=${APP_ORIGIN}, DB_HOST=${DB_HOST})"

# ── 5. Datenbank einrichten ────────────────────────────────────
hdr "5/9 Datenbank einrichten"

# Bei Remote-DB liegt der Server woanders, aber der mysql-Client muss hier sein
if ! command -v mysql &> /dev/null; then
    info "mysql-Client nicht gefunden – wird installiert..."
    # || true, damit set -e nicht ohne Meldung abbricht — der Check danach entscheidet
    { apt-get install -y mariadb-client > /dev/null 2>&1 || apt-get install -y mysql-client > /dev/null 2>&1; } || true
    command -v mysql &> /dev/null && ok "mysql-Client installiert" \
        || err "mysql-Client konnte nicht installiert werden (mariadb-client / mysql-client)"
fi

# Lokal: Ubuntu nutzt standardmäßig Socket-Auth → als root einfach "mysql" reicht.
# Remote: immer über TCP mit explizitem Host/Port/User.
# ARRAY statt String: bei einem Passwort mit Leerzeichen würde ein String beim
# Aufruf per Word-Splitting zerfallen ("-pmein" "geheimes" "pw") und mysql
# interpretierte den Rest als Datenbanknamen.
# Das Passwort steht in einer Optionsdatei, nicht in der Kommandozeile: auf
# einem Mehrbenutzer-Server kann sonst jeder per 'ps aux' mitlesen, solange der
# Aufruf läuft. '--defaults-extra-file' muss das ERSTE Argument sein.
ADMIN_CNF=$(mktemp /tmp/azubiboard-admin.XXXXXX.cnf)
chmod 600 "$ADMIN_CNF"
trap 'rm -f "$ADMIN_CNF"' EXIT   # auch bei Abbruch nicht liegen lassen
if [ "$DB_REMOTE" -eq 1 ]; then
    printf '[client]\nuser=%s\npassword=%s\n' "$MYSQL_ADMIN_USER" "$MYSQL_ROOT_PASS" > "$ADMIN_CNF"
    MYSQL_ARGS=("--defaults-extra-file=$ADMIN_CNF" -h "$DB_HOST" -P "$DB_PORT")
elif [ -n "$MYSQL_ROOT_PASS" ]; then
    printf '[client]\nuser=root\npassword=%s\n' "$MYSQL_ROOT_PASS" > "$ADMIN_CNF"
    MYSQL_ARGS=("--defaults-extra-file=$ADMIN_CNF")
else
    # Socket-Auth als root: gar kein Passwort nötig
    MYSQL_ARGS=()
fi

# Verbindung testen
if ! mysql "${MYSQL_ARGS[@]}" -e "SELECT 1;" > /dev/null 2>&1; then
    if [ "$DB_REMOTE" -eq 1 ]; then
        err "Verbindung zu ${DB_HOST}:${DB_PORT} fehlgeschlagen. Prüfen: Zugangsdaten, bind-address auf dem DB-Server (nicht 127.0.0.1), Firewall Port ${DB_PORT}, und dass '${MYSQL_ADMIN_USER}' von ${SERVER_IP} aus verbinden darf."
    else
        err "MySQL-Verbindung fehlgeschlagen. Bitte root-Passwort prüfen oder 'sudo mysql' manuell testen."
    fi
fi
ok "MySQL-Verbindung: OK (${DB_HOST}:${DB_PORT})"

# Von wo darf der App-User verbinden? Lokal 'localhost', bei separatem
# DB-Server die IP dieses Webservers.
if [ "$DB_REMOTE" -eq 1 ]; then
    # Ohne IP wäre der GRANT leer und der App-User käme nie rein — das fiele
    # sonst erst beim ersten Login der App auf.
    [ -z "$SERVER_IP" ] && err "Server-IP konnte nicht ermittelt werden (hostname -I leer). Bei Datenbank auf ${DB_HOST} wird sie für die Rechtevergabe gebraucht."
    DB_USER_HOST="$SERVER_IP"
else
    DB_USER_HOST="localhost"
fi

# Datenbank + User anlegen
# ALTER USER zusätzlich: bei Re-Run mit neuem Passwort greift CREATE ... IF NOT EXISTS
# nicht, die .env hätte dann ein Passwort das die DB nicht kennt.
mysql "${MYSQL_ARGS[@]}" << EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME}
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_USER_HOST}'
    IDENTIFIED BY '${DB_PASS}';

ALTER USER '${DB_USER}'@'${DB_USER_HOST}'
    IDENTIFIED BY '${DB_PASS}';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, LOCK TABLES
    ON ${DB_NAME}.*
    TO '${DB_USER}'@'${DB_USER_HOST}';

FLUSH PRIVILEGES;
EOF
ok "Datenbank '$DB_NAME' und User '${DB_USER}'@'${DB_USER_HOST}' angelegt"

# Schema importieren: setup.sql (Basis) + azubiboard.sql (relationales
# Sprint-12-Ziel-Schema, idempotent) + sprint12_phase2.sql (Lernpfade etc.).
# Ohne die relationalen Tabellen sind Migration/Dual-Write/RLS nicht nutzbar.
# --force: azubiboard.sql kollidiert planmäßig mit setup.sql (users-PK, Fehler 1068) —
# ohne --force bricht mysql dort ab und alle AUTO_INCREMENTs/FOREIGN KEYs danach fehlen.
for SQL_FILE in setup.sql azubiboard.sql migrations/sprint12_phase2.sql; do
    if [ -f "$REPO_DIR/database/$SQL_FILE" ]; then
        if mysql "${MYSQL_ARGS[@]}" --force "$DB_NAME" < "$REPO_DIR/database/$SQL_FILE" 2>/tmp/azubiboard-sql-err.log; then
            ok "Schema importiert: $SQL_FILE"
        else
            info "⚠ $SQL_FILE: Import-Fehler (siehe /tmp/azubiboard-sql-err.log) — manuell prüfen"
        fi
    fi
done

# Kanonische Phase-2-Migration (idempotent; gepflegt in database/migration_helpers.php).
# Läuft gegen APP_DIR, damit api/config.php die dortige .env findet.
if [ -f "$APP_DIR/database/migrations/sprint12_phase2.php" ]; then
    # Ausgabe in eine Logdatei statt nach /dev/null: beim Lauf vom 24.07.2026 meldete
    # dieser Schritt einen Fehler, der mangels Log nicht nachvollziehbar war.
    if php "$APP_DIR/database/migrations/sprint12_phase2.php" > /tmp/azubiboard-migration.log 2>&1; then
        ok "Phase-2-Migration (PHP) angewendet"
    else
        info "⚠ Phase-2-Migration meldete Fehler — Ursache: /tmp/azubiboard-migration.log"
        tail -n 5 /tmp/azubiboard-migration.log | sed 's/^/      /'
        info "  manuell nachholen: php $APP_DIR/database/migrations/sprint12_phase2.php"
    fi
fi

# ── 6. Apache konfigurieren ────────────────────────────────────
hdr "6/9 Apache konfigurieren"

# Apache muss vorhanden sein — auf einem Server mit nginx ist er es evtl. nicht
if ! command -v apache2ctl &> /dev/null; then
    info "Apache ist nicht installiert — wird nachinstalliert..."
    apt-get install -y apache2 libapache2-mod-php > /tmp/azubiboard-apache-install.log 2>&1 \
        || err "Apache konnte nicht installiert werden (Log: /tmp/azubiboard-apache-install.log)"
    ok "Apache installiert"
fi

# Ausweich-Port eintragen (in Schritt 0 ermittelt). Idempotent: die vorhandene
# Listen-Zeile wird auf WEB_PORT gesetzt, egal welcher Port dort steht.
if [ "$WEB_PORT" != "80" ]; then
    if [ -f /etc/apache2/ports.conf ]; then
        cp -n /etc/apache2/ports.conf /etc/apache2/ports.conf.azubiboard.bak 2>/dev/null || true
        sed -i -E "s/^Listen [0-9]+$/Listen ${WEB_PORT}/" /etc/apache2/ports.conf
        ok "Apache lauscht auf Port ${WEB_PORT} (Sicherung: ports.conf.azubiboard.bak)"
    fi
    VHOST=/etc/apache2/sites-available/000-default.conf
    if [ -f "$VHOST" ]; then
        cp -n "$VHOST" "${VHOST}.azubiboard.bak" 2>/dev/null || true
        sed -i -E "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${WEB_PORT}>/" "$VHOST"
    fi
fi

# mod_rewrite + mod_headers + mod_expires aktivieren
a2enmod rewrite  > /dev/null 2>&1
a2enmod headers  > /dev/null 2>&1
a2enmod expires  > /dev/null 2>&1
ok "mod_rewrite, mod_headers und mod_expires aktiviert"

# Apache-Config für azubiboard.
# vendor/ und database/ nie ausliefern: dort liegen PHP-Bibliotheken (vendor/
# .../phpunit ist ein bekannter Angriffsweg) und das komplette DB-Schema.
cat > /etc/apache2/conf-available/azubiboard.conf << EOF
<Directory /var/www/html/azubiboard>
    AllowOverride All
    Require all granted
    Options -Indexes +FollowSymLinks
</Directory>
<Directory /var/www/html/azubiboard/vendor>
    Require all denied
</Directory>
<Directory /var/www/html/azubiboard/database>
    Require all denied
</Directory>
EOF

a2enconf azubiboard > /dev/null 2>&1
ok "Apache-Konfiguration für azubiboard aktiviert (vendor/ + database/ gesperrt)"

# PHP-Upload-Limit anpassen
PHP_INI=$(php --ini | grep "Loaded Configuration" | awk '{print $NF}')
if [ -f "$PHP_INI" ]; then
    sed -i 's/upload_max_filesize = .*/upload_max_filesize = 15M/' "$PHP_INI"
    sed -i 's/post_max_size = .*/post_max_size = 16M/' "$PHP_INI"
    ok "PHP Upload-Limit auf 15M gesetzt ($PHP_INI)"
fi

# Apache neu starten — aber erst nach einer Syntaxprüfung. Auf einem Server,
# der noch andere Seiten ausliefert, legt ein Neustart mit fehlerhafter
# Konfiguration ALLES lahm, nicht nur AzubiBoard.
if ! apache2ctl configtest > /tmp/azubiboard-apache-test.log 2>&1; then
    err "Apache-Konfiguration fehlerhaft — NICHT neu gestartet. Meldung: $(tail -3 /tmp/azubiboard-apache-test.log | tr '\n' ' ')"
fi

if ! systemctl restart apache2 > /tmp/azubiboard-apache-restart.log 2>&1; then
    # Häufigste Ursache auf einem belegten Server: Port 80/443 gehört jemand anderem
    BELEGER=$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443)\s' | head -2 )
    info "⚠ Apache konnte nicht neu gestartet werden."
    [ -n "$BELEGER" ] && info "  Port 80/443 werden gehalten von: $(echo "$BELEGER" | tr '\n' ' ')"
    err "Apache-Neustart fehlgeschlagen. Details: journalctl -u apache2 -n 30 (Log: /tmp/azubiboard-apache-restart.log)"
fi
ok "Apache neu gestartet (Konfiguration vorher geprüft)"

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
host=${DB_HOST}
port=${DB_PORT}
EOF
chmod 600 /etc/mysql/azubiboard-backup.cnf
ok "MySQL-Credentials für Backup gespeichert (/etc/mysql/azubiboard-backup.cnf)"

# Backup-Skript erstellen
cat > /usr/local/bin/azubiboard-backup.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/azubiboard"
DAY=$(date +%Y-%m-%d)
mysqldump --defaults-extra-file=/etc/mysql/azubiboard-backup.cnf --single-transaction azubiboard 2>/dev/null \
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

# Die Sicherung EINMAL wirklich laufen lassen. Ein Backup, das nie lief, ist
# keins — und nur so fällt sofort auf, wenn mysqldump die Zugangsdaten oder den
# Port nicht akzeptiert, statt erst im Ernstfall.
info "Sicherung wird einmal zur Probe erstellt..."
/usr/local/bin/azubiboard-backup.sh > /tmp/azubiboard-backup-probe.log 2>&1 || true
PROBE=$(find "$BACKUP_DIR" -name '*.sql.gz' -newermt '-5 minutes' -size +1k 2>/dev/null | head -1)
if [ -n "$PROBE" ]; then
    ok "Probe-Sicherung erfolgreich: $(basename "$PROBE") ($(du -h "$PROBE" | cut -f1))"
else
    info "⚠ Die Probe-Sicherung hat keine brauchbare Datei erzeugt."
    info "  Von Hand prüfen: /usr/local/bin/azubiboard-backup.sh && ls -l $BACKUP_DIR"
fi

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

# '/.' am Quellpfad ist Pflicht: 'cp -r src/api dst/api' legt bei existierendem
# Ziel dst/api/api an und laesst die alten PHP-Dateien unveraendert stehen —
# die API wuerde nie aktualisiert.
cp -r "\$REPO_DIR/dist/."     "\$APP_DIR/"
cp -r "\$REPO_DIR/api/."      "\$APP_DIR/api/"
cp -r "\$REPO_DIR/database/." "\$APP_DIR/database/"
[ -d "\$REPO_DIR/vendor" ] && cp -r "\$REPO_DIR/vendor/." "\$APP_DIR/vendor/"

chown -R www-data:www-data "\$APP_DIR"
chmod -R 755 "\$APP_DIR"
# Nach dem pauschalen chmod die Sonderrechte wiederherstellen: sonst waere die
# .env (DB-Passwort, JWT_SECRET) nach jedem Deploy fuer alle Nutzer lesbar.
chmod 640 "\$APP_DIR/.env" 2>/dev/null || true
find "\$APP_DIR" -maxdepth 1 -name '.env.bak.*' -exec chmod 640 {} + 2>/dev/null || true
chmod -R 775 "\$APP_DIR/uploads" 2>/dev/null || true

systemctl reload apache2 2>/dev/null || true
log "Deploy abgeschlossen (\${REMOTE:0:7})"
SCRIPT
chmod 750 /usr/local/bin/azubiboard-deploy.sh
ok "Deploy-Skript erstellt (/usr/local/bin/azubiboard-deploy.sh)"

# Cron: alle 10 Minuten auf neue Commits prüfen — aber nur, wenn hier überhaupt
# ein git-Repo liegt. Wird vom USB-/Zip-Installer aus gestartet, scheitert jeder
# Lauf an 'git fetch' und der Cron schreibt bloss alle 10 min eine Fehlerzeile.
if git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    cat > /etc/cron.d/azubiboard-deploy << 'CRON'
# AzubiBoard – automatischer Deploy bei neuem Commit auf main
*/10 * * * * root /usr/local/bin/azubiboard-deploy.sh
CRON
    chmod 644 /etc/cron.d/azubiboard-deploy
    AUTO_DEPLOY="an"
    ok "Cron-Job eingerichtet (alle 10 min, Log: /var/log/azubiboard-deploy.log)"
else
    rm -f /etc/cron.d/azubiboard-deploy
    AUTO_DEPLOY="aus"
    info "⚠ $REPO_DIR ist kein git-Repo — Auto-Deploy-Cron NICHT eingerichtet"
    info "  Für Auto-Deploy: git clone des Repos anlegen und Installer von dort erneut starten"
fi

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

# ── PMA: phpMyAdmin auf den richtigen DB-Server zeigen lassen ─
# Der Debian-Default verbindet immer nach localhost. Liegt die Datenbank auf
# einem eigenen Server, findet phpMyAdmin dort nichts — deshalb Server 1 hart
# auf $DB_HOST umbiegen (überschreiben statt anhängen: kein Server-Dropdown).
hdr "PMA: phpMyAdmin konfigurieren"

if [ ! -d /usr/share/phpmyadmin ]; then
    info "phpMyAdmin wird installiert..."
    # dbconfig-install=false: der pma-Konfigspeicher gehört nicht auf diesen Host,
    # die DB liegt ggf. remote und wir wollen dort nichts anlegen.
    echo "phpmyadmin phpmyadmin/dbconfig-install boolean false" | debconf-set-selections
    echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2" | debconf-set-selections
    DEBIAN_FRONTEND=noninteractive apt-get install -y phpmyadmin > /dev/null 2>&1 || true
fi

if [ ! -d /etc/phpmyadmin/conf.d ]; then
    info "⚠ phpMyAdmin nicht gefunden — übersprungen (manuell: apt-get install phpmyadmin)"
elif [ "$DB_REMOTE" -eq 0 ]; then
    # Lokale DB: Debian-Default passt (localhost → Unix-Socket). Eine Config von
    # einem früheren Remote-Lauf würde hier auf den falschen Server zeigen.
    rm -f /etc/phpmyadmin/conf.d/azubiboard.php
    ok "phpMyAdmin nutzt die lokale Datenbank (Debian-Default)"
else
    cat > /etc/phpmyadmin/conf.d/azubiboard.php << PMA
<?php
// AzubiBoard – von install_ubuntu.sh erzeugt, wird bei jedem Lauf überschrieben.
\$cfg['Servers'][1]['host']            = '${DB_HOST}';
\$cfg['Servers'][1]['port']            = '${DB_PORT}';
\$cfg['Servers'][1]['connect_type']    = 'tcp';
\$cfg['Servers'][1]['socket']          = '';
\$cfg['Servers'][1]['auth_type']       = 'cookie';
\$cfg['Servers'][1]['verbose']         = 'AzubiBoard DB (${DB_HOST})';
\$cfg['Servers'][1]['AllowNoPassword'] = false;
// Kein pma-Konfigspeicher eingerichtet (dbconfig-install=false)
\$cfg['Servers'][1]['controluser']     = '';
\$cfg['Servers'][1]['controlpass']     = '';
\$cfg['Servers'][1]['pmadb']           = '';
PMA
    chmod 644 /etc/phpmyadmin/conf.d/azubiboard.php
    ok "phpMyAdmin zeigt auf ${DB_HOST}:${DB_PORT}"
fi

# phpMyAdmin ist über Port 80 sonst aus dem ganzen Netz erreichbar.
# <Location> gewinnt gegen die <Directory>-Regeln der Debian-Conf.
if [ -d /etc/phpmyadmin/conf.d ]; then
    cat > /etc/apache2/conf-available/azubiboard-phpmyadmin.conf << 'PMAAP'
# AzubiBoard: phpMyAdmin nur aus dem lokalen Netz erreichbar
<Location /phpmyadmin>
    Require ip 127.0.0.1 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
</Location>
PMAAP
    a2enconf azubiboard-phpmyadmin > /dev/null 2>&1
    systemctl reload apache2 2>/dev/null || true
    ok "Zugriff auf /phpmyadmin auf lokale Netze beschränkt"
fi

# ── SEC1: UFW + Fail2ban ─────────────────────────────────────
hdr "SEC1: UFW + Fail2ban einrichten"

# Echten SSH-Port aus der Konfiguration lesen; 22 ist nur der Default.
# Wird von UFW UND von der fail2ban-sshd-Jail gebraucht.
SSH_PORTS=$(grep -hoP '^\s*Port\s+\K[0-9]+' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | sort -u)
SSH_PORTS=${SSH_PORTS:-22}
SSH_PORT_LIST=${SSH_PORTS//$'\n'/,}

# UFW: NUR die Ports ergänzen, die AzubiBoard braucht.
# Kein 'ufw reset', kein Umstellen der Default-Policy, kein ungefragtes Aktivieren:
# auf einem Server laufen andere Dienste (DB, Monitoring, abweichender SSH-Port),
# und ein Installer, der die Firewall plattmacht, sperrt genau die aus.
if [ "$SETUP_UFW" = "nein" ]; then
    info "Firewall unverändert gelassen — AzubiBoard braucht eingehend Port 80 (und 443 mit HTTPS)"
elif command -v ufw &>/dev/null || apt-get install -y -q ufw &>/dev/null; then
    if [ "$SETUP_UFW" = "ja" ]; then
        # Erst die Regeln, dann enable — sonst kappt das Aktivieren die eigene SSH-Sitzung
        for P in $SSH_PORTS; do ufw allow "${P}/tcp" > /dev/null 2>&1; done
        ufw default deny incoming  > /dev/null 2>&1
        ufw default allow outgoing > /dev/null 2>&1
    fi

    ufw allow "${WEB_PORT}/tcp" > /dev/null 2>&1   # HTTP (ggf. Ausweich-Port)
    ufw allow 443/tcp > /dev/null 2>&1   # HTTPS

    if [ "$SETUP_UFW" = "ja" ]; then
        ufw --force enable > /dev/null 2>&1
        ok "UFW aktiviert (SSH ${SSH_PORT_LIST} + 80/443 offen)"
    else
        ok "UFW war bereits aktiv — nur 80/443 ergänzt, bestehende Regeln unangetastet"
    fi

    echo ""
    ufw status numbered 2>/dev/null | sed 's/^/     /'
    echo ""
else
    info "UFW konnte nicht installiert werden — manuell nachholen"
fi

# Fail2ban: Apache + SSH schützen
if apt-get install -y -q fail2ban &>/dev/null; then
    # port aus sshd_config statt 'ssh' (= fest 22): bei abweichendem SSH-Port
    # wuerde fail2ban sonst auf dem falschen Port bannen und liefe ins Leere.
    cat > /etc/fail2ban/jail.d/azubiboard.conf << F2B
[sshd]
enabled  = true
port     = ${SSH_PORT_LIST}
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
# ── Selbsttest ────────────────────────────────────────────────
# Bisher meldete das Skript "Installation abgeschlossen", ohne je geprüft zu
# haben, ob die Anwendung antwortet. Auf einem Server mit vorhandener Software
# ist genau das die offene Frage. Der Selbsttest geht denselben Weg wie ein
# Browser — er bricht am Ende NICHT hart ab (die Installation steht ja), meldet
# aber deutlich, was nicht stimmt.
hdr "Selbsttest"

SELBSTTEST_PROBLEME=0
melde_problem() { info "⚠ $1"; SELBSTTEST_PROBLEME=$((SELBSTTEST_PROBLEME + 1)); }
# -s still, -S Fehler zeigen, -o Body, -w Statuscode; 127.0.0.1 statt localhost
hole() { curl -s -S -o /tmp/azubiboard-check.body -w '%{http_code}' --max-time 15 "$1" 2>/dev/null || echo "000"; }

BASIS="http://127.0.0.1:${WEB_PORT}/azubiboard"

CODE=$(hole "$BASIS/")
if [ "$CODE" = "200" ] && grep -q 'id="root"' /tmp/azubiboard-check.body 2>/dev/null; then
    ok "Frontend antwortet (HTTP 200)"
    WEB_OK=1
elif [ "$CODE" = "000" ]; then
    melde_problem "Keine Antwort auf $BASIS/ — läuft apache2? (systemctl status apache2)"
    WEB_OK=0
else
    melde_problem "Frontend antwortet mit HTTP $CODE statt 200"
    WEB_OK=1
fi

if [ "$WEB_OK" = "1" ]; then
    CODE=$(hole "$BASIS/api/")
    if grep -q 'Unbekannte Route' /tmp/azubiboard-check.body 2>/dev/null; then
        ok "API und PHP laufen (Router antwortet)"
    elif grep -q '<?php' /tmp/azubiboard-check.body 2>/dev/null; then
        melde_problem "PHP wird NICHT ausgeführt — der Quelltext wird ausgeliefert (libapache2-mod-php aktiv?)"
    else
        melde_problem "API antwortet unerwartet (HTTP $CODE)"
    fi

    # .env enthält DB-Passwort und JWT-Secret und darf nie ausgeliefert werden
    CODE=$(hole "$BASIS/.env")
    if [ "$CODE" = "200" ]; then
        melde_problem "SCHWER: $BASIS/.env ist abrufbar (DB-Passwort + JWT-Secret!) — greift AllowOverride/.htaccess?"
    else
        ok ".env ist nicht abrufbar (HTTP $CODE)"
    fi

    if [ -f "$APP_DIR/vendor/autoload.php" ]; then
        CODE=$(hole "$BASIS/vendor/autoload.php")
        if [ "$CODE" = "200" ]; then
            melde_problem "vendor/ ist über den Browser erreichbar — Sperre in der Apache-Konfiguration prüfen"
        else
            ok "vendor/ ist gesperrt (HTTP $CODE)"
        fi
    fi
else
    info "Weitere HTTP-Prüfungen übersprungen — der Webserver antwortet nicht"
fi

# Datenbank genau auf dem Weg der Anwendung: .env → config.php → PDO
if [ -f "$APP_DIR/api/config.php" ]; then
    cat > /tmp/azubiboard-dbcheck.php << 'PHPCHK'
<?php
require_once getenv('AB_APP_DIR') . '/api/config.php';
try { db()->query('SELECT 1'); echo 'DBOK'; }
catch (Throwable $e) { echo 'DBFEHLER: ' . $e->getMessage(); }
PHPCHK
    DBANTWORT=$(AB_APP_DIR="$APP_DIR" php /tmp/azubiboard-dbcheck.php 2>&1)
    rm -f /tmp/azubiboard-dbcheck.php
    if echo "$DBANTWORT" | grep -q 'DBOK'; then
        ok "Datenbank-Zugang der App funktioniert (.env + PDO)"
    else
        melde_problem "Die App kommt nicht an die Datenbank: $DBANTWORT"
    fi
fi
rm -f /tmp/azubiboard-check.body

if [ "$SELBSTTEST_PROBLEME" -eq 0 ]; then
    ok "Selbsttest bestanden — die Anwendung läuft"
else
    echo ""
    echo -e "${RED}  Selbsttest: $SELBSTTEST_PROBLEME Punkt(e) stimmen nicht — siehe Meldungen oben.${NC}"
    echo -e "${RED}  Die Installation ist damit nicht vollständig einsatzbereit.${NC}"
fi

hdr "9/9 Fertig"

echo ""
echo -e "${GREEN}================================================${NC}"
if [ "$SELBSTTEST_PROBLEME" -eq 0 ]; then
    echo -e "${GREEN}  Installation abgeschlossen!${NC}"
else
    echo -e "${YELLOW}  Installation abgeschlossen — mit Einschränkungen (siehe Selbsttest)${NC}"
fi
echo -e "${GREEN}================================================${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
    echo -e "  App-URL:    ${CYAN}https://${DOMAIN}/azubiboard/${NC}"
else
    echo -e "  App-URL:    ${CYAN}http://${SERVER_IP}/azubiboard/${NC}"
fi
echo -e "  Datenbank:  ${CYAN}${DB_HOST}:${DB_PORT}${NC}  (User '${DB_USER}'@'${DB_USER_HOST}')"
echo -e "  phpMyAdmin: ${CYAN}http://${SERVER_IP}/phpmyadmin${NC}  (verbindet nach ${DB_HOST}, nur lokales Netz)"
echo -e "  DB-Backups: ${CYAN}/var/backups/azubiboard/${NC}  (tägl. 03:00, 30 Tage)"
if [ "$AUTO_DEPLOY" = "an" ]; then
    echo -e "  Auto-Deploy: alle 10 min, Log: ${CYAN}/var/log/azubiboard-deploy.log${NC}"
else
    echo -e "  Auto-Deploy: ${YELLOW}inaktiv${NC} (kein git-Repo in $REPO_DIR)"
fi
if [ "$SETUP_UFW" = "nein" ]; then
    echo -e "  Firewall:    unverändert (UFW nicht angefasst) · Fail2ban aktiv"
else
    echo -e "  Firewall:    UFW · 80/443 für AzubiBoard offen · Fail2ban aktiv"
fi
echo -e "  Deploy-Key:  /root/.ssh/azubiboard_deploy.pub → in GitHub eintragen!"
echo ""
echo -e "${YELLOW}  Nächste Schritte:${NC}"
APP_URL="${APP_ORIGIN}"
echo "  1. ${APP_URL}/azubiboard/ im Browser öffnen"
echo "  2. Account registrieren"
echo "  3. Ausbilder-Rolle setzen:"
echo ""
# Passwort bewusst NICHT ausgeben (-p fragt interaktiv), sonst steht es im Terminal-Log
if [ "$DB_REMOTE" -eq 1 ]; then
    MYSQL_HINT="mysql -h ${DB_HOST} -P ${DB_PORT} -u ${MYSQL_ADMIN_USER} -p"
elif [ -n "$MYSQL_ROOT_PASS" ]; then
    MYSQL_HINT="mysql -u root -p"
else
    MYSQL_HINT="sudo mysql"
fi
echo -e "     ${CYAN}${MYSQL_HINT} -e \"UPDATE azubiboard.users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';\"${NC}"
echo ""
