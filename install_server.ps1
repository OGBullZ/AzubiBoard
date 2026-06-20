#requires -Version 5.1
<#
============================================================
  AzubiBoard - Autonomer USB-Installer (Windows-Server)
============================================================

  EIN-KLICK-SETUP fuer einen Windows-Arbeitsserver:
  Stick rein -> dieses Skript ausfuehren -> fertig.

  Das Skript erledigt ALLES selbst:
    - hebt sich bei Bedarf auf Admin-Rechte
    - installiert XAMPP (Apache + PHP + MariaDB) falls fehlend
    - registriert Apache + MariaDB als echte Windows-DIENSTE
      (Autostart beim Boot, keine XAMPP-Tray-App noetig)
    - installiert Node.js LTS falls fehlend
    - baut das Frontend direkt auf dem Server (npm ci + build)
    - installiert PHP-Dependencies (Composer + vendor/)
    - generiert .env (Server-IP/DB-Pass/JWT-Secret automatisch
      ODER interaktiv mit -Interactive)
    - legt Datenbank + User an und importiert das Schema
    - konfiguriert Apache (mod_rewrite/mod_headers/AllowOverride)
    - oeffnet die Windows-Firewall (Port 80)
    - richtet eine taegliche DB-Sicherung (Scheduled Task) ein

  AUSFUEHREN:
    Rechtsklick auf install_server.ps1 -> "Mit PowerShell ausfuehren"
    (oder)  pwsh -ExecutionPolicy Bypass -File .\install_server.ps1

  XAMPP AUF DEN STICK:
    Lege die echte xampp-windows-x64-8.2.x-installer.exe NEBEN dieses Skript
    auf den USB-Stick. Das Skript findet sie automatisch und installiert offline
    (zuverlaessiger als der SourceForge-Download). Ohne Stick-Datei wird als
    Fallback heruntergeladen.

  OPTIONEN:
    -Interactive          .env-Werte abfragen statt automatisch wuerfeln
    -ServerIp <ip>        Server-IP manuell setzen (sonst Auto-Erkennung)
    -DbPass <pass>        DB-User-Passwort manuell setzen (sonst Zufall)
    -DbRootPass <pass>    MariaDB-root-Passwort (falls root nicht leer ist)
    -AdminEmail <mail>    diese E-Mail nach Registrierung auf 'ausbilder'
                          setzen (oder beim Re-Run sofort, falls vorhanden)
    -XamppInstaller <pfad> xampp-...-installer.exe vom Stick (Offline-Install)
    -XamppPath <pfad>     XAMPP-Verzeichnis (Default C:\xampp; z.B. E:\xampp)
    -SkipXampp            XAMPP nur pruefen, nicht installieren
    -SkipBackupTask       keine taegliche DB-Sicherung einrichten
    -DryRun               TROCKENLAUF: nur Build/Composer/DB-Verbindung laufen
                          echt; Dienste/Config/Deploy/DB-Anlage/Firewall/Task
                          werden nur simuliert (veraendert das System nicht)
============================================================
#>
[CmdletBinding()]
param(
    [switch]$Interactive,
    [string]$ServerIp,
    [string]$DbPass,
    [string]$DbRootPass,
    [string]$AdminEmail,
    [string]$XamppInstaller,
    [string]$XamppPath = 'C:\xampp',
    [switch]$SkipXampp,
    [switch]$SkipBackupTask,
    [switch]$DryRun
)

# ── Versionen der externen Downloads (bei Bedarf hier aktualisieren) ──
$XAMPP_URL = 'https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.2.12/xampp-windows-x64-8.2.12-0-VS16-installer.exe/download'
$NODE_URL  = 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi'

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Pfade ────────────────────────────────────────────────────
$repoRoot   = $PSScriptRoot
$xamppPath  = $XamppPath
$appPath    = "$xamppPath\htdocs\azubiboard"
$buildDir   = 'C:\azubiboard-src'
$backupDir  = 'C:\azubiboard-backups'
$mysqlExe   = "$xamppPath\mysql\bin\mysqld.exe"
$mysqlCli   = "$xamppPath\mysql\bin\mysql.exe"
$mysqlDump  = "$xamppPath\mysql\bin\mysqldump.exe"
$apacheExe  = "$xamppPath\apache\bin\httpd.exe"
$apacheConf = "$xamppPath\apache\conf\httpd.conf"
$phpExe     = "$xamppPath\php\php.exe"
$phpIni     = "$xamppPath\php\php.ini"
$composer   = "$xamppPath\php\composer"
$APACHE_SVC = 'Apache2.4'
$MYSQL_SVC  = 'mysql'

# ── Ausgabe-Helfer ───────────────────────────────────────────
function Hdr ($t) { Write-Host ""; Write-Host "[$t]" -ForegroundColor Cyan }
function Ok  ($t) { Write-Host "  + $t" -ForegroundColor Green }
function Info($t) { Write-Host "  > $t" -ForegroundColor Yellow }
function Die ($t) { Write-Host "  x $t" -ForegroundColor Red; exit 1 }
function Dry ($t) { Write-Host "  ~ [TROCKEN] wuerde: $t" -ForegroundColor DarkGray }

function New-RandomSecret([int]$len) {
    $chars = (48..57) + (65..90) + (97..122)   # 0-9 A-Z a-z
    -join (1..$len | ForEach-Object { [char]($chars | Get-Random) })
}

# UTF-8 OHNE BOM schreiben - Set-Content -Encoding UTF8 setzt in PS 5.1 ein BOM,
# das httpd.conf/php.ini/.env am ersten Eintrag zerschiesst.
function Set-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding $false))
}

# ── 0. Admin-Rechte sicherstellen (ggf. neu starten) ─────────
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and -not $DryRun) {
    Write-Host "Starte mit Administrator-Rechten neu..." -ForegroundColor Yellow
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Interactive)        { $argList += '-Interactive' }
    if ($ServerIp)           { $argList += @('-ServerIp', $ServerIp) }
    if ($DbPass)             { $argList += @('-DbPass', $DbPass) }
    if ($DbRootPass)         { $argList += @('-DbRootPass', $DbRootPass) }
    if ($AdminEmail)         { $argList += @('-AdminEmail', $AdminEmail) }
    if ($XamppInstaller)     { $argList += @('-XamppInstaller', "`"$XamppInstaller`"") }
    if ($SkipXampp)          { $argList += '-SkipXampp' }
    if ($SkipBackupTask)     { $argList += '-SkipBackupTask' }
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs
    exit
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AzubiBoard - Autonomer Server-Installer"  -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  TROCKENLAUF: nur Build/Composer/DB-Verbindung laufen echt;" -ForegroundColor Magenta
    Write-Host "  Dienste/Config/Deploy/DB-Anlage/Firewall/Task werden nur simuliert." -ForegroundColor Magenta
    Write-Host "  XAMPP-Pfad: $xamppPath" -ForegroundColor Magenta
}

# ── 1. XAMPP sicherstellen ───────────────────────────────────
Hdr "1/10 XAMPP (Apache + PHP + MariaDB)"
if (Test-Path $mysqlExe) {
    Ok "XAMPP bereits vorhanden: $xamppPath"
} elseif ($SkipXampp) {
    Die "XAMPP fehlt und -SkipXampp gesetzt. Bitte XAMPP nach $xamppPath installieren."
} else {
    $installer = $XamppInstaller
    if (-not $installer) {
        # Installer evtl. neben diesem Skript auf dem Stick suchen
        $local = Get-ChildItem -Path $repoRoot -Filter 'xampp-windows-*installer.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($local) { $installer = $local.FullName }
    }
    if (-not $installer) {
        Info "XAMPP wird heruntergeladen (~160 MB)..."
        $installer = "$env:TEMP\xampp-installer.exe"
        try {
            Invoke-WebRequest -Uri $XAMPP_URL -OutFile $installer -UseBasicParsing
        } catch {
            Die "XAMPP-Download fehlgeschlagen ($_). Installer manuell besorgen und mit -XamppInstaller <pfad> uebergeben."
        }
    }
    # Validierung: echte XAMPP-.exe ist ~150 MB; SourceForge-Fehlseite waere nur KB
    if (-not (Test-Path $installer) -or (Get-Item $installer).Length -lt 50MB) {
        Die "XAMPP-Installer ungueltig/zu klein: $installer. Echte xampp-windows-...-installer.exe (~160 MB) auf den Stick legen (neben dieses Skript) oder -XamppInstaller <pfad> nutzen."
    }
    Info "XAMPP wird still installiert nach $xamppPath ..."
    $p = Start-Process -FilePath $installer `
        -ArgumentList '--mode', 'unattended', '--unattendedmodeui', 'minimal', '--prefix', $xamppPath, '--launchapps', '0' `
        -Wait -PassThru
    if (-not (Test-Path $mysqlExe)) { Die "XAMPP-Installation nicht erfolgreich (Exit $($p.ExitCode))." }
    Ok "XAMPP installiert"
}

# ── 2. Apache + MariaDB als Windows-Dienste ──────────────────
Hdr "2/10 Apache + MariaDB als Windows-Dienste"

if ($DryRun) {
    Dry "XAMPP-Tray-Prozesse stoppen (mysqld/httpd/xampp-control), falls aktiv"
    Dry "MariaDB-Dienst '$MYSQL_SVC' registrieren (Autostart) + starten"
    Dry "Apache-Dienst '$APACHE_SVC' registrieren (Autostart)"
} else {

# Laufende XAMPP-Tray-Prozesse stoppen (blockieren sonst Port 3306/80 + Dienst-Install).
# Nur wenn noch KEINE Dienste existieren - sonst wuerden wir den Dienst-Prozess killen.
$svcExists = (Get-Service -Name $MYSQL_SVC -ErrorAction SilentlyContinue) -or
             (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue)
if (-not $svcExists) {
    foreach ($pName in 'xampp-control', 'mysqld', 'httpd') {
        $procs = Get-Process -Name $pName -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$xamppPath*" }
        if ($procs) {
            Info "Stoppe laufenden $pName (XAMPP-Tray) fuer Dienst-Installation..."
            $procs | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }
}

# MariaDB-Dienst
if (-not (Get-Service -Name $MYSQL_SVC -ErrorAction SilentlyContinue)) {
    Info "MariaDB-Dienst wird registriert..."
    & $mysqlExe --install $MYSQL_SVC "--defaults-file=$xamppPath\mysql\bin\my.ini" | Out-Null
    Start-Sleep -Seconds 2
}
if (Get-Service -Name $MYSQL_SVC -ErrorAction SilentlyContinue) {
    Set-Service -Name $MYSQL_SVC -StartupType Automatic
    if ((Get-Service $MYSQL_SVC).Status -ne 'Running') { Start-Service $MYSQL_SVC }
    Ok "MariaDB-Dienst laeuft (Autostart)"
} else {
    Die "MariaDB-Dienst konnte nicht registriert werden."
}

# Apache-Dienst
if (-not (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue)) {
    Info "Apache-Dienst wird registriert..."
    & $apacheExe -k install -n $APACHE_SVC | Out-Null
    Start-Sleep -Seconds 2
}
if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) {
    Set-Service -Name $APACHE_SVC -StartupType Automatic
    Ok "Apache-Dienst registriert (Autostart)"
} else {
    Info "Apache-Dienst nicht registriert - wird nach Konfiguration erneut versucht."
}

}  # Ende DryRun-Guard Abschnitt 2

# ── 3. Node.js sicherstellen ─────────────────────────────────
Hdr "3/10 Node.js (fuer den Frontend-Build)"
function Test-Node { (Get-Command node -ErrorAction SilentlyContinue) -ne $null }
if (Test-Node) {
    Ok "Node.js vorhanden: $(node -v)"
} elseif ($DryRun) {
    Dry "Node.js LTS herunterladen + installieren (fehlt aktuell)"
} else {
    Info "Node.js LTS wird installiert..."
    $msi = "$env:TEMP\node-lts.msi"
    try {
        Invoke-WebRequest -Uri $NODE_URL -OutFile $msi -UseBasicParsing
        Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/qn', '/norestart' -Wait
    } catch {
        Die "Node.js-Installation fehlgeschlagen: $_"
    }
    # PATH der aktuellen Sitzung auffrischen (Maschinen- + Benutzer-PATH)
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (Test-Node)) { Die "Node.js nicht im PATH nach Installation. Neu anmelden und Skript erneut starten." }
    Ok "Node.js installiert: $(node -v)"
}

# ── 4. Frontend bauen + PHP-Setup ────────────────────────────
Hdr "4/10 Frontend bauen (npm ci + build)"
if (-not (Test-Path "$repoRoot\package.json")) {
    Die "package.json nicht gefunden in $repoRoot - liegt das Skript im Projekt-Stammordner?"
}

if ($DryRun -and -not (Test-Node)) {
    Dry "Quellcode spiegeln + npm ci + build (uebersprungen: Node fehlt im Trockenlauf)"
} else {

# Quellcode auf lokale Platte spiegeln (USB ist langsam; node_modules/dist/.git ausschliessen)
Info "Quellcode nach $buildDir spiegeln..."
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
robocopy $repoRoot $buildDir /MIR /XD node_modules dist .git vendor test-results /XF *.exe /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Die "robocopy (Quellcode) fehlgeschlagen (Code $LASTEXITCODE)." }

# 'prepare'-Script aus der Build-Kopie entfernen: es ruft 'git config core.hooksPath
# .githooks || true' - der Build-Ordner ist kein git-Repo (scheitert) UND 'true' gibt
# es auf Windows-cmd nicht -> npm ci/install braechen ab. Hooks sind beim Server-Build
# irrelevant; Dependency-Install-Scripts (esbuild etc.) bleiben unberuehrt.
$pkgPath = "$buildDir\package.json"
try {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if ($pkg.scripts -and $pkg.scripts.PSObject.Properties['prepare']) {
        $pkg.scripts.PSObject.Properties.Remove('prepare')
        Set-Utf8NoBom $pkgPath ($pkg | ConvertTo-Json -Depth 30)
        Info "package.json: 'prepare'-Hook fuer den Build entfernt"
    }
} catch {
    Info "package.json prepare-Strip uebersprungen: $_"
}

Push-Location $buildDir
try {
    Info "npm ci ..."
    # Playwright-Browser-Download verhindern (haengt auf Windows; Build braucht ihn nicht)
    $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Info "npm ci fehlgeschlagen - Fallback auf npm install"
        npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Die "npm install fehlgeschlagen." }
    }
    Info "npm run build ..."
    $env:VITE_BASE_PATH = '/azubiboard/'
    $env:VITE_USE_API   = 'true'
    npm run build
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$buildDir\dist\index.html")) { Die "Frontend-Build fehlgeschlagen." }
    Ok "Build erfolgreich (dist/ erstellt)"
} finally {
    Pop-Location
}

}  # Ende DryRun/Node-Guard Abschnitt 4

# PHP: zip-Extension + Upload-Limits
Hdr "5/10 PHP konfigurieren + Composer"
if (Test-Path $phpIni) {
    $ini = Get-Content $phpIni -Raw
    if     ($ini -match '(?m)^;extension=zip\s*$') { $ini = $ini -replace '(?m)^;extension=zip\s*$', 'extension=zip' }
    elseif ($ini -notmatch '(?m)^extension=zip\s*$') { $ini = $ini.TrimEnd() + "`nextension=zip`n" }
    $ini = $ini -replace '(?m)^upload_max_filesize\s*=.*$', 'upload_max_filesize = 15M'
    $ini = $ini -replace '(?m)^post_max_size\s*=.*$',       'post_max_size = 16M'
    if ($DryRun) { Dry "php.ini schreiben (zip aktiv, Upload-Limit 15M) -> $phpIni" }
    else { Set-Utf8NoBom $phpIni $ini; Ok "php.ini: zip aktiv, Upload-Limit 15M" }
} else {
    Info "php.ini nicht gefunden - PHP-Feinkonfiguration uebersprungen"
}

# Composer sicherstellen
if (-not (Test-Path $composer)) {
    Info "Composer wird installiert..."
    $setup = "$env:TEMP\composer-setup.php"
    try {
        Invoke-WebRequest -Uri 'https://getcomposer.org/installer' -OutFile $setup -UseBasicParsing
        & $phpExe $setup --install-dir="$xamppPath\php" --filename=composer 2>&1 | Out-Null
        Remove-Item $setup -ErrorAction SilentlyContinue
        Ok "Composer installiert"
    } catch {
        Info "Composer-Install fehlgeschlagen ($_) - PHP-Dependencies werden uebersprungen"
    }
}
# composer install im Build-Ordner (erzeugt vendor/ inkl. PHPMailer-Runtime)
if ((Test-Path $composer) -and (Test-Path "$buildDir\composer.json")) {
    Info "composer install ..."
    Push-Location $buildDir
    try {
        & $phpExe $composer install --no-interaction --prefer-dist --no-progress 2>&1 | Out-Null
        if (Test-Path "$buildDir\vendor\bin\phpunit") {
            $smoke = & $phpExe "$buildDir\vendor\phpunit\phpunit\phpunit" --testsuite=smoke 2>&1 | Out-String
            if ($smoke -match 'OK \(\d+ test') { Ok "PHPUnit Smoke-Test gruen" }
            else { Info "PHPUnit Smoke-Test unklar - spaeter pruefen: vendor\bin\phpunit --testsuite=smoke" }
        }
        Ok "PHP-Dependencies installiert (vendor/)"
    } catch {
        Info "composer install fehlgeschlagen: $_"
    } finally {
        Pop-Location
    }
}

# ── 6. Dateien deployen ──────────────────────────────────────
Hdr "6/10 Dateien nach $appPath deployen"
if ($DryRun) {
    Dry "dist/ + api/ + database/ + vendor/ + composer.* nach $appPath kopieren"
    Dry "uploads/ anlegen + fuer 'Users' beschreibbar machen"
} else {
New-Item -ItemType Directory -Path "$appPath\uploads" -Force | Out-Null
# uploads/ enthaelt nur User-Bilder - Skript-Ausfuehrung hart unterbinden (Polyglot-RCE-Schutz)
$uploadsHtaccess = @"
# AzubiBoard: uploads/ enthaelt nur User-Bilder - niemals Skripte ausfuehren/ausliefern
<FilesMatch "\.(php|phtml|php[0-9]|phps|pht|cgi|pl|py|asp|aspx|sh|exe)$">
    Require all denied
</FilesMatch>
RemoveHandler .php .phtml .phps .cgi .pl
"@
Set-Utf8NoBom "$appPath\uploads\.htaccess" $uploadsHtaccess
robocopy "$buildDir\dist"     $appPath          /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$buildDir\api"      "$appPath\api"    /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$buildDir\database" "$appPath\database" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if (Test-Path "$buildDir\vendor") {
    robocopy "$buildDir\vendor" "$appPath\vendor" /E /NFL /NDL /NJH /NJS /NP | Out-Null
}
Copy-Item "$buildDir\composer.json" $appPath -Force -ErrorAction SilentlyContinue
Copy-Item "$buildDir\composer.lock" $appPath -Force -ErrorAction SilentlyContinue
if (-not (Test-Path "$appPath\index.html")) { Die "Deploy unvollstaendig - index.html fehlt in $appPath." }
Ok "Frontend, API, DB-Schema und vendor/ deployed"

# uploads/ beschreibbar machen (Apache-Prozess laeuft als lokaler Dienst -> Users)
try {
    $acl  = Get-Acl "$appPath\uploads"
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        'Users', 'Modify', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl "$appPath\uploads" $acl
    Ok "uploads/ beschreibbar"
} catch {
    Info "uploads/-Rechte manuell setzen: Eigenschaften -> Sicherheit -> Users: Aendern"
}

}  # Ende DryRun-Guard Abschnitt 6

# ── 7. .env erstellen ────────────────────────────────────────
Hdr "7/10 Konfiguration (.env)"
if (-not $ServerIp) {
    $ServerIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -First 1).IPAddress
}
if (-not $ServerIp) { $ServerIp = 'localhost' }

if ($Interactive) {
    Write-Host ""
    $inIp = Read-Host "  Server-IP [$ServerIp]"
    if ($inIp) { $ServerIp = $inIp }
    while (-not $DbPass) {
        $s1 = Read-Host "  DB-Passwort fuer 'azubiboard_user'" -AsSecureString
        $s2 = Read-Host "  Passwort bestaetigen" -AsSecureString
        $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
        $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
        if ($p1 -and $p1 -eq $p2) { $DbPass = $p1 } else { Write-Host "  Passwoerter stimmen nicht / leer - nochmal." -ForegroundColor Red }
    }
}
if (-not $DbPass)  { $DbPass  = New-RandomSecret 24 }
$jwtSecret = New-RandomSecret 64

$envContent = @"
VITE_BASE_PATH=/azubiboard/
VITE_USE_API=true

DB_HOST=localhost
DB_PORT=3306
DB_NAME=azubiboard
DB_USER=azubiboard_user
DB_PASS=$DbPass

JWT_SECRET=$jwtSecret
JWT_EXPIRY=604800

ALLOWED_ORIGIN=http://$ServerIp

APP_ENV=production

# Sprint 12: Dual-Write Blob -> relationale Tabellen
BACKEND_DUAL_WRITE=false

# SMTP (leer = native mail())
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_SECURE=tls
# SMTP_FROM=azubiboard@example.de
# SMTP_FROM_NAME=AzubiBoard
"@
if ($DryRun) {
    $dryEnv = "$buildDir\.env.dryrun"
    if (Test-Path $buildDir) { Set-Utf8NoBom $dryEnv $envContent; Dry ".env nach $appPath schreiben (Beispiel hier: $dryEnv)" }
    else { Dry ".env nach $appPath schreiben (ALLOWED_ORIGIN=http://$ServerIp)" }
} else {
    Set-Utf8NoBom "$appPath\.env" $envContent
    Ok ".env erstellt (ALLOWED_ORIGIN=http://$ServerIp)"
    if (-not $Interactive) { Info "DB-Pass + JWT-Secret automatisch generiert (in .env nachschlagbar)" }
}

# ── 8. Datenbank einrichten ──────────────────────────────────
Hdr "8/10 Datenbank einrichten"
$mdbSvc = Get-Service $MYSQL_SVC -ErrorAction SilentlyContinue
if ($mdbSvc -and $mdbSvc.Status -ne 'Running' -and -not $DryRun) { Start-Service $MYSQL_SVC; Start-Sleep -Seconds 2 }

# root-Auth zusammenbauen (XAMPP-Standard: root ohne Passwort; sonst -DbRootPass)
$rootAuth = @('-u', 'root')
if ($DbRootPass) { $rootAuth += "-p$DbRootPass" }

# Verbindung testen, bevor wir Schreiboperationen versuchen
'SELECT 1;' | & $mysqlCli @rootAuth --connect-timeout=10 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    if ($DryRun) { Info "MariaDB nicht erreichbar (laeuft im Trockenlauf evtl. nicht) - im echten Lauf wird der Dienst gestartet" }
    else { Die "MariaDB-root-Login fehlgeschlagen. Hat root ein Passwort? Dann erneut mit -DbRootPass <pass> starten." }
} else {
    Ok "MariaDB-root-Verbindung: OK"
}

$sqlSetup = @"
CREATE DATABASE IF NOT EXISTS azubiboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'azubiboard_user'@'localhost' IDENTIFIED BY '$DbPass';
ALTER USER 'azubiboard_user'@'localhost' IDENTIFIED BY '$DbPass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, LOCK TABLES ON azubiboard.* TO 'azubiboard_user'@'localhost';
FLUSH PRIVILEGES;
"@
if ($DryRun) {
    Dry "Datenbank 'azubiboard' + User 'azubiboard_user' anlegen (GRANTs)"
    foreach ($sqlName in @('setup.sql', 'azubiboard.sql', 'migrations\sprint12_phase2.sql')) {
        $srcSql = "$buildDir\database\$sqlName"
        if (Test-Path $srcSql) { Dry "Schema importieren: $sqlName" }
        else { Info "database\$sqlName nicht im Build-Ordner gefunden" }
    }
    if ($AdminEmail) { Dry "Rolle 'ausbilder' fuer '$AdminEmail' setzen (falls Account existiert)" }
} else {
    $sqlSetup | & $mysqlCli @rootAuth --connect-timeout=10
    if ($LASTEXITCODE -ne 0) { Die "Datenbank/User anlegen fehlgeschlagen - laeuft MariaDB?" }
    Ok "Datenbank 'azubiboard' und User 'azubiboard_user' angelegt"

    foreach ($sqlName in @('setup.sql', 'azubiboard.sql', 'migrations\sprint12_phase2.sql')) {
        $sqlFile = "$appPath\database\$sqlName"
        if (-not (Test-Path $sqlFile)) { Info "database\$sqlName nicht vorhanden - uebersprungen"; continue }
        Get-Content $sqlFile -Raw | & $mysqlCli @rootAuth azubiboard --connect-timeout=10 2>$null
        if ($LASTEXITCODE -eq 0) { Ok "Schema importiert: $sqlName" }
        else { Info "${sqlName}: Import-Hinweis (evtl. bereits vorhanden)" }
    }

    # AdminEmail sofort setzen, falls der Account bereits existiert (Re-Run)
    if ($AdminEmail) {
        $safeMail = $AdminEmail -replace "'", "''"
        "UPDATE users SET role='ausbilder' WHERE email='$safeMail';" | & $mysqlCli @rootAuth azubiboard 2>$null
        Ok "Falls Account '$AdminEmail' existiert: Rolle auf 'ausbilder' gesetzt"
    }
}

# ── 9. Apache konfigurieren + Firewall ───────────────────────
Hdr "9/10 Apache konfigurieren + Firewall"
if (Test-Path $apacheConf) {
    $conf = Get-Content $apacheConf -Raw
    $changed = $false
    if ($conf -match '(?m)^#LoadModule rewrite_module') { $conf = $conf -replace '(?m)^#LoadModule rewrite_module', 'LoadModule rewrite_module'; $changed = $true; Ok "mod_rewrite aktiviert" } else { Ok "mod_rewrite aktiv" }
    if ($conf -match '(?m)^#LoadModule headers_module') { $conf = $conf -replace '(?m)^#LoadModule headers_module', 'LoadModule headers_module'; $changed = $true; Ok "mod_headers aktiviert" } else { Ok "mod_headers aktiv" }
    if ($conf -match 'AllowOverride None')              { $conf = $conf -replace 'AllowOverride None', 'AllowOverride All'; $changed = $true; Ok "AllowOverride All gesetzt" } else { Ok "AllowOverride korrekt" }
    if ($changed -and $DryRun) { Dry "httpd.conf speichern (Aenderungen oben) -> $apacheConf" }
    elseif ($changed) { Set-Utf8NoBom $apacheConf $conf; Ok "httpd.conf gespeichert" }
} else {
    Info "httpd.conf nicht gefunden - Apache manuell konfigurieren"
}

# Port 80 belegt? (z.B. IIS/W3SVC auf einem Arbeitsserver) - Apache wuerde sonst nicht starten
$busy = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $ownerProc = Get-Process -Id ($busy | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
    if ($ownerProc -and $ownerProc.ProcessName -notmatch 'httpd') {
        Info "ACHTUNG: Port 80 ist belegt durch '$($ownerProc.ProcessName)' (z.B. IIS)."
        Info "  Apache startet erst, wenn der Dienst frei ist - z.B.: Stop-Service W3SVC; Set-Service W3SVC -StartupType Disabled"
        Info "  Alternativ Apache-Port in httpd.conf (Listen 80 -> 8080) aendern."
    }
}

if ($DryRun) {
    Dry "Apache-Dienst '$APACHE_SVC' registrieren/starten"
    Dry "Firewall-Regel 'AzubiBoard HTTP (80)' (TCP 80 eingehend) anlegen"
} else {
# Apache-Dienst (erneut versuchen, falls vorher nicht registriert) + starten
if (-not (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue)) {
    & $apacheExe -k install -n $APACHE_SVC | Out-Null
    Start-Sleep -Seconds 2
    if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) { Set-Service -Name $APACHE_SVC -StartupType Automatic }
}
if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) {
    Restart-Service $APACHE_SVC -ErrorAction SilentlyContinue
    if ((Get-Service $APACHE_SVC).Status -ne 'Running') { Start-Service $APACHE_SVC -ErrorAction SilentlyContinue }
    Ok "Apache-Dienst laeuft"
} else {
    Info "Apache nicht als Dienst - via XAMPP Control Panel starten"
}

# Firewall: Port 80 eingehend
if (-not (Get-NetFirewallRule -DisplayName 'AzubiBoard HTTP (80)' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'AzubiBoard HTTP (80)' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any | Out-Null
    Ok "Firewall-Regel fuer Port 80 angelegt"
} else {
    Ok "Firewall-Regel fuer Port 80 vorhanden"
}
}  # Ende DryRun-Guard Abschnitt 9

# ── 10. Taegliche DB-Sicherung (Scheduled Task) ──────────────
Hdr "10/10 Taegliche DB-Sicherung"
if ($SkipBackupTask) {
    Info "uebersprungen (-SkipBackupTask)"
} elseif ($DryRun) {
    Dry "Backup-Skript nach $backupDir schreiben + Scheduled Task 'AzubiBoard DB-Backup' (taegl. 03:00) anlegen"
} else {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $backupScript = "$backupDir\azubiboard-backup.ps1"
    # root-Passwort (falls gesetzt) ins Backup-Skript uebernehmen
    $rootPassArg = if ($DbRootPass) { "-p$DbRootPass" } else { '' }
    $bs = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$day  = Get-Date -Format 'yyyy-MM-dd'
`$sql  = '$backupDir\azubiboard_' + `$day + '.sql'
`$zip  = '$backupDir\azubiboard_' + `$day + '.zip'
# --result-file schreibt die Datei direkt (kein PowerShell-Pipe -> kein UTF-8-BOM, Umlaute bleiben heil)
& '$mysqlDump' -u root $rootPassArg --single-transaction --result-file=`$sql azubiboard
if (Test-Path `$sql) {
    Compress-Archive -Path `$sql -DestinationPath `$zip -Force
    Remove-Item `$sql -Force
}
Get-ChildItem '$backupDir' -Filter '*.zip' | Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
"@
    Set-Utf8NoBom $backupScript $bs
    try {
        $action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
        $trigger = New-ScheduledTaskTrigger -Daily -At 3am
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName 'AzubiBoard DB-Backup' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
        Ok "Taegliche Sicherung 03:00 -> $backupDir (30 Tage Aufbewahrung)"
    } catch {
        Info "Scheduled Task konnte nicht angelegt werden: $_"
    }
}

# ── Fertig ───────────────────────────────────────────────────
Write-Host ""
if ($DryRun) {
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "  TROCKENLAUF abgeschlossen - nichts veraendert" -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "  Echt gelaufen: Build, Composer, DB-Verbindung. Rest war simuliert." -ForegroundColor Magenta
    Write-Host ""
    exit 0
}
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Installation abgeschlossen!"              -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App-URL:     http://$ServerIp/azubiboard/" -ForegroundColor Cyan
Write-Host "  phpMyAdmin:  http://localhost/phpmyadmin   (nur lokal)" -ForegroundColor Cyan
Write-Host "  DB-Backups:  $backupDir  (taegl. 03:00, 30 Tage)" -ForegroundColor Cyan
Write-Host "  Dienste:     Apache + MariaDB laufen als Autostart-Dienste" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Naechste Schritte:" -ForegroundColor Yellow
Write-Host "   1. http://$ServerIp/azubiboard/ oeffnen + Account registrieren"
Write-Host "   2. Ausbilder-Rolle setzen:"
Write-Host "      & '$mysqlCli' -u root azubiboard -e `"UPDATE users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';`"" -ForegroundColor White
Write-Host ""
exit 0
