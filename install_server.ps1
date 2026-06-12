# ============================================================
#  AzubiBoard – Automatisches Setup-Skript
#  Dieses Skript auf dem SERVER ausführen (Als Administrator!),
#  nachdem XAMPP installiert wurde und die App-Dateien nach
#  C:\xampp\htdocs\azubiboard\ kopiert wurden.
#
#  Starten: Rechtsklick → "Als Administrator ausführen"
#  Oder in PowerShell (Admin): .\install_server.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$xamppPath  = "C:\xampp"
$appPath    = "C:\xampp\htdocs\azubiboard"
$mysqlExe   = "$xamppPath\mysql\bin\mysql.exe"
$mysqlAdmin = "$xamppPath\mysql\bin\mysqladmin.exe"
$apacheConf = "$xamppPath\apache\conf\httpd.conf"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  AzubiBoard Server-Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. XAMPP prüfen ──────────────────────────────────────────
Write-Host "[1/7] XAMPP prüfen..." -ForegroundColor Yellow
if (-not (Test-Path $xamppPath)) {
    Write-Host "FEHLER: XAMPP nicht gefunden unter $xamppPath" -ForegroundColor Red
    Write-Host "Bitte XAMPP installieren von https://www.apachefriends.org" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $mysqlExe)) {
    Write-Host "FEHLER: MySQL/MariaDB nicht gefunden: $mysqlExe" -ForegroundColor Red
    exit 1
}
Write-Host "  XAMPP gefunden: OK" -ForegroundColor Green

# ── 2. App-Dateien prüfen ────────────────────────────────────
Write-Host "[2/7] App-Dateien prüfen..." -ForegroundColor Yellow
if (-not (Test-Path "$appPath\index.html")) {
    Write-Host "FEHLER: App-Dateien nicht gefunden unter $appPath" -ForegroundColor Red
    Write-Host "Bitte zuerst alle Dateien nach C:\xampp\htdocs\azubiboard\ kopieren." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$appPath\.env")) {
    Write-Host "FEHLER: .env Datei fehlt in $appPath" -ForegroundColor Red
    Write-Host "Bitte .env.server nach $appPath\.env kopieren und SERVER-IP eintragen." -ForegroundColor Red
    exit 1
}
Write-Host "  App-Dateien: OK" -ForegroundColor Green

# ── 3. PHP-Setup: zip-Extension + Composer + Dependencies ────
Write-Host "[3/7] PHP-Setup (zip-Extension + Composer)..." -ForegroundColor Yellow
$phpIni    = "$xamppPath\php\php.ini"
$phpExe    = "$xamppPath\php\php.exe"
$composer  = "$xamppPath\php\composer"
$composerB = "$xamppPath\php\composer.bat"

# 3a) zip-Extension aktivieren (Composer braucht das für --prefer-dist)
if (Test-Path $phpIni) {
    $ini = Get-Content $phpIni -Raw
    if ($ini -match '(?m)^;extension=zip\s*$') {
        $ini = $ini -replace '(?m)^;extension=zip\s*$', 'extension=zip'
        Set-Content -Path $phpIni -Value $ini -Encoding UTF8
        Write-Host "  php.ini: extension=zip aktiviert" -ForegroundColor Green
    } elseif ($ini -match '(?m)^extension=zip\s*$') {
        Write-Host "  php.ini: extension=zip bereits aktiv" -ForegroundColor Green
    } else {
        Add-Content -Path $phpIni -Value "`nextension=zip"
        Write-Host "  php.ini: extension=zip ergänzt" -ForegroundColor Green
    }
} else {
    Write-Host "  WARNUNG: $phpIni nicht gefunden — PHP-Setup übersprungen" -ForegroundColor Yellow
}

# 3b) Composer installieren wenn nicht vorhanden
if (-not (Test-Path $composer)) {
    Write-Host "  Composer wird installiert..." -ForegroundColor Yellow
    $setup = "$env:TEMP\composer-setup.php"
    try {
        Invoke-WebRequest -Uri "https://getcomposer.org/installer" -OutFile $setup -UseBasicParsing -ErrorAction Stop
        & $phpExe $setup --install-dir="$xamppPath\php" --filename=composer 2>&1 | Out-Null
        Remove-Item $setup -ErrorAction SilentlyContinue
        # .bat-Wrapper für komfortablen Aufruf
        Set-Content -Path $composerB -Value "@echo off`r`n`"$phpExe`" `"%~dp0composer`" %*" -Encoding ASCII
        Write-Host "  Composer installiert: $composer" -ForegroundColor Green
    } catch {
        Write-Host "  WARNUNG: Composer-Install fehlgeschlagen: $_" -ForegroundColor Yellow
        Write-Host "  PHP-Dependencies (PHPUnit für Tests) werden übersprungen." -ForegroundColor Yellow
    }
} else {
    Write-Host "  Composer bereits installiert" -ForegroundColor Green
}

# 3c) composer install ausführen wenn composer.json existiert
if ((Test-Path $composer) -and (Test-Path "$appPath\composer.json")) {
    Write-Host "  composer install läuft..." -ForegroundColor Yellow
    Push-Location $appPath
    try {
        & $phpExe $composer install --no-interaction --prefer-dist 2>&1 | Out-Null
        if (Test-Path "$appPath\vendor\bin\phpunit") {
            Write-Host "  PHP-Dependencies installiert (PHPUnit verfügbar)" -ForegroundColor Green
            # Smoke-Test: phpunit findet Konfig und läuft
            $smoke = & $phpExe "$appPath\vendor\phpunit\phpunit\phpunit" --testsuite=smoke 2>&1 | Out-String
            if ($smoke -match 'OK \(\d+ tests') {
                Write-Host "  PHPUnit Smoke-Test: OK" -ForegroundColor Green
            } else {
                Write-Host "  Hinweis: PHPUnit Smoke-Test nicht eindeutig — manuell prüfen: cd $appPath; vendor\bin\phpunit --testsuite=smoke" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  WARNUNG: composer install lief, aber vendor\bin\phpunit fehlt" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  WARNUNG: composer install fehlgeschlagen: $_" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
} elseif (Test-Path "$appPath\composer.json") {
    Write-Host "  composer.json gefunden, aber Composer nicht verfügbar — übersprungen" -ForegroundColor Yellow
}

# ── 4. uploads/-Ordner anlegen & Rechte setzen ───────────────
Write-Host "[4/7] Uploads-Ordner einrichten..." -ForegroundColor Yellow
$uploadsPath = "$appPath\uploads"
if (-not (Test-Path $uploadsPath)) {
    New-Item -ItemType Directory -Path $uploadsPath | Out-Null
}
# IIS_IUSRS und IUSR Schreibrecht geben (für Apache-Prozess)
try {
    $acl = Get-Acl $uploadsPath
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("IUSR","Write","Allow")
    $acl.SetAccessRule($rule)
    Set-Acl $uploadsPath $acl
} catch {
    Write-Host "  Hinweis: Berechtigungen konnten nicht automatisch gesetzt werden." -ForegroundColor Yellow
    Write-Host "  Manuell: Rechtsklick auf uploads\ → Eigenschaften → Sicherheit → IUSR: Schreiben" -ForegroundColor Yellow
}
Write-Host "  uploads/ Ordner: OK" -ForegroundColor Green

# ── 4. Datenbank einrichten ───────────────────────────────────
Write-Host "[5/7] Datenbank einrichten..." -ForegroundColor Yellow

# DB-Passwort aus .env lesen
$envContent = Get-Content "$appPath\.env" | Where-Object { $_ -match "^DB_PASS=" }
$dbPass = ($envContent -split "=", 2)[1].Trim()

if ($dbPass -eq "" -or $dbPass -eq "HIER_SICHERES_PASSWORT_WAEHLEN") {
    Write-Host "FEHLER: DB_PASS in .env ist noch nicht gesetzt!" -ForegroundColor Red
    exit 1
}

# Datenbank + User anlegen (MySQL als root, kein Passwort bei Standard-XAMPP)
$sqlSetup = @"
CREATE DATABASE IF NOT EXISTS azubiboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'azubiboard_user'@'localhost' IDENTIFIED BY '$dbPass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER ON azubiboard.* TO 'azubiboard_user'@'localhost';
FLUSH PRIVILEGES;
"@

try {
    $sqlSetup | & $mysqlExe -u root --connect-timeout=5 2>&1
    Write-Host "  Datenbank und User angelegt: OK" -ForegroundColor Green
} catch {
    Write-Host "FEHLER beim Datenbankzugriff: $_" -ForegroundColor Red
    Write-Host "Starte MariaDB im XAMPP Control Panel und versuche es nochmal." -ForegroundColor Yellow
    exit 1
}

# Schema importieren: setup.sql (Basis) + azubiboard.sql (relationales
# Sprint-12-Ziel-Schema, idempotent) + sprint12_phase2.sql (Lernpfade etc.)
foreach ($sqlName in @('setup.sql', 'azubiboard.sql', 'migrations\sprint12_phase2.sql')) {
    $sqlFile = "$appPath\database\$sqlName"
    if (-not (Test-Path $sqlFile)) {
        Write-Host "  Hinweis: database\$sqlName nicht gefunden, übersprungen." -ForegroundColor Yellow
        continue
    }
    try {
        & $mysqlExe -u root azubiboard --connect-timeout=5 "-e" "source $sqlFile" 2>&1
        Write-Host "  Schema importiert: ${sqlName}: OK" -ForegroundColor Green
    } catch {
        Write-Host "  Hinweis: $sqlName Import fehlgeschlagen (evtl. bereits vorhanden): $_" -ForegroundColor Yellow
    }
}

# ── 5. Apache konfigurieren ────────────────────────────────────
Write-Host "[6/7] Apache konfigurieren..." -ForegroundColor Yellow
if (-not (Test-Path $apacheConf)) {
    Write-Host "  WARNUNG: httpd.conf nicht gefunden — Apache manuell konfigurieren." -ForegroundColor Yellow
} else {
    $conf = Get-Content $apacheConf -Raw

    $changed = $false

    # mod_rewrite aktivieren
    if ($conf -match '#LoadModule rewrite_module') {
        $conf = $conf -replace '#LoadModule rewrite_module', 'LoadModule rewrite_module'
        $changed = $true
        Write-Host "  mod_rewrite aktiviert" -ForegroundColor Green
    } else {
        Write-Host "  mod_rewrite: bereits aktiv" -ForegroundColor Green
    }

    # mod_headers aktivieren
    if ($conf -match '#LoadModule headers_module') {
        $conf = $conf -replace '#LoadModule headers_module', 'LoadModule headers_module'
        $changed = $true
        Write-Host "  mod_headers aktiviert" -ForegroundColor Green
    } else {
        Write-Host "  mod_headers: bereits aktiv" -ForegroundColor Green
    }

    # AllowOverride All in htdocs-Block
    if ($conf -match 'AllowOverride None') {
        $conf = $conf -replace 'AllowOverride None', 'AllowOverride All'
        $changed = $true
        Write-Host "  AllowOverride All gesetzt" -ForegroundColor Green
    } else {
        Write-Host "  AllowOverride: bereits korrekt" -ForegroundColor Green
    }

    if ($changed) {
        Set-Content $apacheConf $conf -Encoding UTF8
        Write-Host "  httpd.conf gespeichert" -ForegroundColor Green
    }
}

# ── 6. Apache neu starten ─────────────────────────────────────
Write-Host "[7/7] Apache neu starten..." -ForegroundColor Yellow
try {
    $apache = Get-Service -Name "Apache*" -ErrorAction SilentlyContinue
    if ($apache) {
        Restart-Service $apache.Name
        Write-Host "  Apache neu gestartet: OK" -ForegroundColor Green
    } else {
        # Über XAMPP-Binary
        $apacheExe = "$xamppPath\apache\bin\httpd.exe"
        if (Test-Path $apacheExe) {
            # XAMPP Control Panel statt direktem httpd-Restart
            Write-Host "  Apache läuft nicht als Windows-Dienst." -ForegroundColor Yellow
            Write-Host "  Bitte im XAMPP Control Panel: Apache STOP → START" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  Bitte Apache im XAMPP Control Panel neu starten." -ForegroundColor Yellow
}

# ── Fertig ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Setup abgeschlossen!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Server-IP ermitteln
$serverIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

Write-Host "Naechste Schritte:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. .env prüfen: ALLOWED_ORIGIN=http://$serverIp" -ForegroundColor White
Write-Host "     (Server-IP: $serverIp)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. App aufrufen: http://$serverIp/azubiboard/" -ForegroundColor White
Write-Host ""
Write-Host "  3. Account registrieren, dann Ausbilder-Rolle setzen:" -ForegroundColor White
Write-Host "     http://localhost/phpmyadmin → azubiboard → users → SQL:" -ForegroundColor White
Write-Host "     UPDATE users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';" -ForegroundColor Yellow
Write-Host ""
