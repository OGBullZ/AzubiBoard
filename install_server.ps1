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
      (lokale XAMPP-MariaDB ODER separater DB-Server via -DbHost)
    - konfiguriert Apache (mod_rewrite/mod_headers/AllowOverride)
    - oeffnet die Windows-Firewall (Port 80)
    - richtet eine taegliche DB-Sicherung (Scheduled Task) ein

  AUSFUEHREN:
    DOPPELKLICK auf install_server.cmd            <- der sichere Weg
    (der Wrapper umgeht ExecutionPolicy/Mark-of-the-Web und haelt das Fenster offen)
    (oder)  powershell -ExecutionPolicy Bypass -File .\install_server.ps1

  WAS AUF DEN STICK GEHOERT (fuer einen Server OHNE Internet):
    1. xampp-windows-x64-8.2.x-installer.exe  neben dieses Skript
       -> wird automatisch gefunden und offline installiert
    2. node-v22.x.x-x64.msi (von nodejs.org)   neben dieses Skript
       -> wird genommen, wenn Node fehlt oder zu alt ist
    3. Ordner 'dist-server' = auf dem Laptop vorgebautes Frontend:
          $env:VITE_BASE_PATH='/azubiboard/'; $env:VITE_USE_API='true'
          npm run build ; Rename-Item dist dist-server
       -> ersetzt npm ci + Build auf dem Server komplett
    4. Ordner 'vendor' (aus composer install) -> ersetzt Composer auf dem Server
    Fehlt Punkt 1/2, wird heruntergeladen. Fehlen 3/4, wird auf dem Server gebaut.

  OPTIONEN:
    -Interactive          .env-Werte abfragen statt automatisch wuerfeln
    -ServerIp <ip>        Server-IP manuell setzen (sonst Auto-Erkennung)
    -DbHost <host>        Datenbank-Server (Default localhost = XAMPP-MariaDB).
                          Liegt die DB auf einem eigenen Server, hier dessen
                          IP angeben (z.B. 10.14.99.12) - dann wird der lokale
                          MariaDB-Dienst nicht registriert und phpMyAdmin auf
                          diesen Host umgestellt.
    -DbPort <port>        Datenbank-Port (Default 3306)
    -DbAdminUser <user>   Admin-Login auf dem DB-Server (Default root)
    -DbPass <pass>        DB-User-Passwort manuell setzen (sonst Zufall)
    -DbRootPass <pass>    Passwort des Admin-Logins (bei -DbHost Pflicht)
    -AdminEmail <mail>    diese E-Mail nach Registrierung auf 'ausbilder'
                          setzen (oder beim Re-Run sofort, falls vorhanden)
    -XamppInstaller <pfad> xampp-...-installer.exe vom Stick (Offline-Install)
    -XamppPath <pfad>     XAMPP-Verzeichnis (Default C:\xampp; z.B. E:\xampp)
    -SkipXampp            XAMPP nur pruefen, nicht installieren
    -SkipBackupTask       keine taegliche DB-Sicherung einrichten
    -DryRun               TROCKENLAUF: nur Build/Composer/DB-Verbindung laufen
                          echt; XAMPP-/Node-Install, Dienste/Config/Deploy/
                          DB-Anlage/Firewall/Task werden nur simuliert
                          (veraendert das System nicht)
    -NoPause              am Ende nicht auf Tastendruck warten (fuer Automatik)

  PROTOKOLL:
    Jeder Lauf schreibt azubiboard-install-<zeitstempel>.log neben das Skript
    (oder ins %TEMP%, wenn der Stick schreibgeschuetzt ist).
============================================================
#>
[CmdletBinding()]
param(
    [switch]$Interactive,
    [string]$ServerIp,
    [string]$DbHost = 'localhost',
    [int]$DbPort = 3306,
    [string]$DbAdminUser = 'root',
    [string]$DbPass,
    [string]$DbRootPass,
    [string]$AdminEmail,
    [string]$XamppInstaller,
    [string]$XamppPath = 'C:\xampp',
    [switch]$SkipXampp,
    [switch]$SkipBackupTask,
    [switch]$DryRun,
    [switch]$NoPause
)

# ── Versionen der externen Downloads (bei Bedarf hier aktualisieren) ──
$XAMPP_URL = 'https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.2.12/xampp-windows-x64-8.2.12-0-VS16-installer.exe/download'
# Vite 7 verlangt Node ^20.19 || >=22.12 (siehe node_modules/vite/package.json).
# 22.11 war ZU ALT und liess den Build auf einem frischen Server scheitern.
$NODE_URL  = 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-x64.msi'
$NODE_MIN  = '22.12.0'   # Untergrenze fuer den 22er-Zweig
$NODE_MIN_20 = '20.19.0' # ein vorhandenes Node 20 ist ab hier ebenfalls ok

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

# Liegt die Datenbank auf einem eigenen Server? Dann laeuft alles ueber TCP,
# der lokale MariaDB-Dienst wird nicht gebraucht und die GRANTs muessen fuer
# die IP dieses Webservers gelten statt fuer 'localhost'.
if (-not $DbHost) { $DbHost = 'localhost' }
$dbRemote = $DbHost -notin @('localhost', '127.0.0.1', '::1')

# ── Ausgabe-Helfer ───────────────────────────────────────────
function Hdr ($t) { Write-Host ""; Write-Host "[$t]" -ForegroundColor Cyan }
function Ok  ($t) { Write-Host "  + $t" -ForegroundColor Green }
function Info($t) { Write-Host "  > $t" -ForegroundColor Yellow }
function Dry ($t) { Write-Host "  ~ [TROCKEN] wuerde: $t" -ForegroundColor DarkGray }

# Der Installer startet sich fuer die Adminrechte in einem NEUEN Fenster neu.
# Das schliesst sich beim Beenden sofort - ohne die Pause haette man weder das
# Ergebnis (App-URL, SQL-Befehl) noch die Fehlermeldung je gesehen.
function Wait-Taste {
    if (-not $script:pauseAtEnd) { return }
    Write-Host ""
    Write-Host "  --- Fenster bleibt offen. Beliebige Taste zum Schliessen. ---" -ForegroundColor DarkGray
    try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') }
    catch { try { Read-Host "  (Enter)" | Out-Null } catch { } }
}
function Stop-Log {
    if ($script:logPath) {
        Write-Host ""
        Write-Host "  Protokoll: $script:logPath" -ForegroundColor DarkGray
    }
    try { Stop-Transcript | Out-Null } catch { }
}
function Die ($t) { Write-Host "  x $t" -ForegroundColor Red; Stop-Log; Wait-Taste; exit 1 }

function New-RandomSecret([int]$len) {
    $chars = (48..57) + (65..90) + (97..122)   # 0-9 A-Z a-z
    -join (1..$len | ForEach-Object { [char]($chars | Get-Random) })
}

# UTF-8 OHNE BOM schreiben - Set-Content -Encoding UTF8 setzt in PS 5.1 ein BOM,
# das httpd.conf/php.ini/.env am ersten Eintrag zerschiesst.
function Set-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding $false))
}

# Native Programme (mysql/composer) schreiben Status UND Fehler auf stderr.
# Windows PowerShell 5.1 wirft bei stderr-Redirect (2>$null / 2>&1) unter
# $ErrorActionPreference='Stop' fuer JEDE stderr-Zeile einen NativeCommandError
# und wuerde das Skript mitten im Install killen (empirisch verifiziert).
# -> solche Aufrufe hier kapseln; $LASTEXITCODE bleibt danach auswertbar.
function Invoke-Native([scriptblock]$Cmd) {
    $ErrorActionPreference = 'Continue'
    & $Cmd
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
    # DB-Parameter mit durchreichen - sonst laeuft die elevierte Instanz wieder
    # gegen localhost und legt die GRANTs auf dem falschen Host an
    $argList += @('-DbHost', "`"$DbHost`"", '-DbPort', $DbPort, '-DbAdminUser', "`"$DbAdminUser`"")
    if ($DbPass)             { $argList += @('-DbPass', $DbPass) }
    if ($DbRootPass)         { $argList += @('-DbRootPass', $DbRootPass) }
    if ($AdminEmail)         { $argList += @('-AdminEmail', $AdminEmail) }
    if ($XamppInstaller)     { $argList += @('-XamppInstaller', "`"$XamppInstaller`"") }
    $argList += @('-XamppPath', "`"$XamppPath`"")
    if ($SkipXampp)          { $argList += '-SkipXampp' }
    if ($SkipBackupTask)     { $argList += '-SkipBackupTask' }
    if ($NoPause)            { $argList += '-NoPause' }
    # Mit derselben Engine neu starten (pwsh bleibt pwsh, 5.1 bleibt 5.1)
    $psExe = if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh.exe' } else { 'powershell.exe' }
    Start-Process -FilePath $psExe -ArgumentList $argList -Verb RunAs
    exit
}

# Ab hier laeuft der echte Durchlauf (die nicht-elevierte Instanz ist oben raus).
# Trockenlauf pausiert nie - der laeuft in Test-Automatik und duerfte nicht haengen.
$script:pauseAtEnd = (-not $NoPause) -and (-not $DryRun) -and [Environment]::UserInteractive
$script:logPath    = $null
try {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $logDir = if ([string]::IsNullOrEmpty($repoRoot)) { $env:TEMP } else { $repoRoot }
    # Der Stick kann schreibgeschuetzt sein - dann ins TEMP ausweichen
    try { [System.IO.File]::WriteAllText("$logDir\.azubiboard-write-test", 'x'); Remove-Item "$logDir\.azubiboard-write-test" -Force }
    catch { $logDir = $env:TEMP }
    $script:logPath = "$logDir\azubiboard-install-$stamp.log"
    Start-Transcript -Path $script:logPath -Force | Out-Null
} catch {
    $script:logPath = $null   # ohne Protokoll weitermachen, nie deswegen scheitern
}

# Auffangnetz: $ErrorActionPreference='Stop' laesst jeden unerwarteten Fehler das
# Skript beenden - ohne trap waere das Fenster weg, bevor man die Ursache liest.
trap {
    Write-Host ""
    Write-Host "  x ABBRUCH durch unerwarteten Fehler:" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    if ($_.InvocationInfo) {
        Write-Host "    Zeile $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor DarkGray
    }
    Stop-Log
    Wait-Taste
    exit 1
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

# Bei -Interactive den DB-Host HIER erfragen (nach der Elevation, vor Schritt 2):
# Schritt 2 entscheidet anhand von $dbRemote, ob der lokale MariaDB-Dienst
# registriert wird. Kaeme die Frage erst in Schritt 7, liefe dieser Dienst
# laengst und belegte Port 3306, obwohl die Datenbank woanders liegt.
if ($Interactive) {
    Write-Host ""
    $inDbHost = Read-Host "  Datenbank-Host [$DbHost] (leer = lokales XAMPP, sonst z.B. 10.14.99.12)"
    if ($inDbHost) { $DbHost = $inDbHost }
    $dbRemote = $DbHost -notin @('localhost', '127.0.0.1', '::1')
    $inDbPort = Read-Host "  Datenbank-Port [$DbPort]"
    if ($inDbPort) { $DbPort = [int]$inDbPort }
    if ($dbRemote) {
        $inAdmin = Read-Host "  Admin-User auf $DbHost [$DbAdminUser]"
        if ($inAdmin) { $DbAdminUser = $inAdmin }
        while (-not $DbRootPass) {
            $sr = Read-Host "  Passwort fuer $DbAdminUser@$DbHost" -AsSecureString
            $DbRootPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sr))
        }
    }
}

# ── 1. XAMPP sicherstellen ───────────────────────────────────
Hdr "1/10 XAMPP (Apache + PHP + MariaDB)"
if (Test-Path $mysqlExe) {
    Ok "XAMPP bereits vorhanden: $xamppPath"
} elseif ($DryRun) {
    # Trockenlauf veraendert das System nicht - auch kein XAMPP-Install
    Dry "XAMPP still nach $xamppPath installieren (fehlt aktuell)"
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
    if ($dbRemote) { Dry "MariaDB-Dienst NICHT registrieren (DB liegt auf $DbHost)" }
    else           { Dry "MariaDB-Dienst '$MYSQL_SVC' registrieren (Autostart) + starten" }
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

# MariaDB-Dienst - nur wenn die Datenbank auch hier laeuft.
# Bei separatem DB-Server wuerde ein lokaler mysqld nur Port 3306 belegen;
# gebraucht wird von XAMPP dann bloss der mysql.exe-Client.
if ($dbRemote) {
    Info "Datenbank liegt auf ${DbHost} - lokaler MariaDB-Dienst wird nicht registriert"
} else {
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

# Vorhandenes Node reicht NICHT automatisch: Vite 7 bricht mit einer alten
# Version ab (z.B. Node 18 auf einem aelteren Arbeitsserver). Darum echte
# Versionspruefung statt blossem "ist node im PATH?".
function Get-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $null }
    try {
        $raw = (& node -v 2>$null | Select-Object -First 1)
        if ($raw -match 'v?(\d+)\.(\d+)\.(\d+)') { return [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" }
    } catch { }
    return $null
}
function Test-NodeOk([version]$v) {
    if (-not $v) { return $false }
    if ($v.Major -eq 20) { return $v -ge [version]$NODE_MIN_20 }
    return $v -ge [version]$NODE_MIN
}
# "Kann gebaut werden?" - auch von Abschnitt 4 benutzt
function Test-Node { Test-NodeOk (Get-NodeVersion) }

$nodeVer = Get-NodeVersion
if (Test-NodeOk $nodeVer) {
    Ok "Node.js vorhanden: v$nodeVer"
} elseif ($DryRun) {
    if ($nodeVer) { Dry "Node.js v$nodeVer ist zu alt (noetig: 20.19+ oder 22.12+) - LTS installieren" }
    else          { Dry "Node.js LTS herunterladen + installieren (fehlt aktuell)" }
} else {
    if ($nodeVer) { Info "Node.js v$nodeVer ist zu alt fuer den Build (noetig: 20.19+ oder 22.12+) - LTS wird installiert..." }
    else          { Info "Node.js LTS wird installiert..." }
    $msi = "$env:TEMP\node-lts.msi"
    # Node darf auch vom Stick kommen (Server ohne Internet)
    $localMsi = Get-ChildItem -Path $repoRoot -Filter 'node-v*-x64.msi' -ErrorAction SilentlyContinue | Select-Object -First 1
    try {
        if ($localMsi) {
            Info "Node-Installer vom Stick: $($localMsi.Name)"
            $msi = $localMsi.FullName
        } else {
            Invoke-WebRequest -Uri $NODE_URL -OutFile $msi -UseBasicParsing
        }
        Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/qn', '/norestart' -Wait
        # PATH der aktuellen Sitzung auffrischen (Maschinen- + Benutzer-PATH)
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                    [Environment]::GetEnvironmentVariable('Path', 'User')
    } catch {
        # KEIN Abbruch: Abschnitt 4 kann auf ein vorgebautes dist/ vom Stick ausweichen
        Info "Node.js-Installation fehlgeschlagen: $_"
    }
    $nodeVer = Get-NodeVersion
    if (Test-NodeOk $nodeVer) {
        Ok "Node.js installiert: v$nodeVer"
    } else {
        Info "Kein brauchbares Node.js - Abschnitt 4 weicht auf einen vorgebauten dist/-Ordner aus"
    }
}

# ── 4. Frontend bauen + PHP-Setup ────────────────────────────
Hdr "4/10 Frontend bauen (npm ci + build)"
if (-not (Test-Path "$repoRoot\package.json")) {
    Die "package.json nicht gefunden in $repoRoot - liegt das Skript im Projekt-Stammordner?"
}

# Vorgebautes Frontend auf dem Stick (Server ohne Internet/ohne Node):
# 'dist-server' ist der eindeutige Ordner (mit VITE_BASE_PATH=/azubiboard/ gebaut),
# 'dist' wird als Zweitkandidat akzeptiert - aber nur nach Base-Path-Pruefung,
# sonst deployt der Installer still ein Frontend, das nur eine weisse Seite zeigt.
function Get-PrebuiltDist {
    foreach ($cand in "$repoRoot\dist-server", "$repoRoot\dist") {
        $idx = "$cand\index.html"
        if (-not (Test-Path $idx)) { continue }
        $html = Get-Content $idx -Raw
        if ($html -match '/azubiboard/assets/') { return @{ Path = $cand; Ok = $true } }
        return @{ Path = $cand; Ok = $false }   # gefunden, aber falscher Base-Path
    }
    return $null
}

$haveNode = Test-Node

# Dieser Abschnitt laeuft AUCH im Trockenlauf echt (er fasst nur den Build-Ordner
# an, nichts am System): nur so beantwortet der Trockenlauf die eigentliche Frage
# vor der Fahrt zum Server - reicht das, was auf dem Stick liegt?

# Quellcode auf lokale Platte spiegeln (USB ist langsam; node_modules/dist/.git ausschliessen)
Info "Quellcode nach $buildDir spiegeln..."
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
# .env* ausschliessen: eine mitkopierte Dev-.env wuerde sonst von Vite gelesen
# (Dev-Secrets/VITE_-Flags im Produktions-Build); der Server bekommt seine .env in Schritt 7
# dist-server (vorgebautes Frontend) + *.msi/*.exe (Installer vom Stick) + das
# laufende Protokoll gehoeren nicht in den Build-Ordner
robocopy $repoRoot $buildDir /MIR /XD node_modules dist dist-server .git vendor test-results /XF *.exe *.msi .env .env.* azubiboard-install-*.log /NFL /NDL /NJH /NJS /NP | Out-Null
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

$buildOk = $false
if ($haveNode) {
    Push-Location $buildDir
    try {
        Info "npm ci ..."
        # Playwright-Browser-Download verhindern (haengt auf Windows; Build braucht ihn nicht)
        $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
        npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Info "npm ci fehlgeschlagen - Fallback auf npm install"
            npm install --no-audit --no-fund
        }
        if ($LASTEXITCODE -eq 0) {
            Info "npm run build ..."
            $env:VITE_BASE_PATH = '/azubiboard/'
            $env:VITE_USE_API   = 'true'
            npm run build
            if ($LASTEXITCODE -eq 0 -and (Test-Path "$buildDir\dist\index.html")) {
                $buildOk = $true
                Ok "Build erfolgreich (dist/ erstellt)"
            }
        }
    } finally {
        Pop-Location
    }
    if (-not $buildOk) { Info "Build auf dem Server fehlgeschlagen (kein Internet? npm-Registry nicht erreichbar?)" }
} else {
    Info "Kein brauchbares Node.js - es wird nicht gebaut"
}

# Rettungsweg: fertiges Frontend vom Stick. Ohne den steht der Installer auf
# einem abgeschotteten Firmenserver (kein Internet -> npm ci scheitert) still.
if (-not $buildOk) {
    $pre = Get-PrebuiltDist
    if ($pre -and $pre.Ok) {
        Info "Uebernehme vorgebautes Frontend: $($pre.Path)"
        robocopy $pre.Path "$buildDir\dist" /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { Die "Kopieren des vorgebauten dist/ fehlgeschlagen (robocopy $LASTEXITCODE)." }
        if (-not (Test-Path "$buildDir\dist\index.html")) { Die "Vorgebautes dist/ unvollstaendig - index.html fehlt." }
        $buildOk = $true
        Ok "Vorgebautes Frontend uebernommen (kein Build noetig)"
    } elseif ($pre) {
        Die @"
Kein Build moeglich UND '$($pre.Path)' passt nicht: dieser Ordner wurde ohne
VITE_BASE_PATH=/azubiboard/ gebaut (das ist z.B. der Firebase-Build) - im Browser
kaeme nur eine weisse Seite. So richtig bauen (auf dem Laptop, mit Internet):
    cd <Projektordner>
    `$env:VITE_BASE_PATH='/azubiboard/'; `$env:VITE_USE_API='true'; npm run build
    Rename-Item dist dist-server
Danach 'dist-server' mit auf den Stick legen und den Installer erneut starten.
"@
    } else {
        Die @"
Frontend konnte nicht gebaut werden und es liegt kein vorgebautes Frontend bei.
Auf einem Server ohne Internet: auf dem Laptop bauen und mitnehmen -
    `$env:VITE_BASE_PATH='/azubiboard/'; `$env:VITE_USE_API='true'; npm run build
    Rename-Item dist dist-server
'dist-server' neben install_server.ps1 auf den Stick legen, dann erneut starten.
"@
    }
}

# PHP: zip-Extension + Upload-Limits
Hdr "5/10 PHP konfigurieren + Composer"
if (Test-Path $phpIni) {
    $ini = Get-Content $phpIni -Raw
    # zip (Backups) + fileinfo (Avatar-MIME-Check in auth.php) sicher aktivieren
    foreach ($ext in 'zip', 'fileinfo') {
        if     ($ini -match "(?m)^;extension=$ext\s*$") { $ini = $ini -replace "(?m)^;extension=$ext\s*$", "extension=$ext" }
        elseif ($ini -notmatch "(?m)^extension=$ext\s*$") { $ini = $ini.TrimEnd() + "`nextension=$ext`n" }
    }
    $ini = $ini -replace '(?m)^upload_max_filesize\s*=.*$', 'upload_max_filesize = 15M'
    $ini = $ini -replace '(?m)^post_max_size\s*=.*$',       'post_max_size = 16M'
    if ($DryRun) { Dry "php.ini schreiben (zip+fileinfo aktiv, Upload-Limit 15M) -> $phpIni" }
    else { Set-Utf8NoBom $phpIni $ini; Ok "php.ini: zip+fileinfo aktiv, Upload-Limit 15M" }
} else {
    Info "php.ini nicht gefunden - PHP-Feinkonfiguration uebersprungen"
}

# Composer sicherstellen (braucht PHP - fehlt im Trockenlauf ohne XAMPP)
if (-not (Test-Path $phpExe)) {
    Info "php.exe nicht vorhanden - Composer/PHP-Dependencies uebersprungen"
} elseif (-not (Test-Path $composer)) {
    Info "Composer wird installiert..."
    $setup = "$env:TEMP\composer-setup.php"
    try {
        Invoke-WebRequest -Uri 'https://getcomposer.org/installer' -OutFile $setup -UseBasicParsing
        Invoke-Native { & $phpExe $setup --install-dir="$xamppPath\php" --filename=composer 2>&1 | Out-Null }
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
        # composer schreibt seine normale Ausgabe auf stderr -> Invoke-Native noetig
        Invoke-Native { & $phpExe $composer install --no-interaction --prefer-dist --no-progress 2>&1 | Out-Null }
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$buildDir\vendor\autoload.php")) {
            throw "composer install Exit $LASTEXITCODE (vendor/autoload.php fehlt)"
        }
        if (Test-Path "$buildDir\vendor\bin\phpunit") {
            $smoke = Invoke-Native { & $phpExe "$buildDir\vendor\phpunit\phpunit\phpunit" --testsuite=smoke 2>&1 | Out-String }
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

# Ohne Internet scheitert Composer. Dann vendor/ vom Stick uebernehmen, sofern
# mitkopiert (haengt nur SMTP-Versand dran - api/mailer.php faellt sonst auf mail()
# zurueck, die App selbst laeuft auch ohne).
if ((Test-Path $buildDir) -and -not (Test-Path "$buildDir\vendor\autoload.php")) {
    if (Test-Path "$repoRoot\vendor\autoload.php") {
        Info "Uebernehme vendor/ vom Stick (Composer war nicht moeglich)..."
        robocopy "$repoRoot\vendor" "$buildDir\vendor" /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if (Test-Path "$buildDir\vendor\autoload.php") { Ok "vendor/ vom Stick uebernommen" }
        else { Info "vendor/ vom Stick unvollstaendig - SMTP-Versand faellt auf mail() zurueck" }
    } else {
        Info "Kein vendor/ vorhanden - E-Mail laeuft ueber mail() statt SMTP (App unbeeintraechtigt)"
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
    # DB-Host/Port/Admin wurden bereits vor Schritt 2 abgefragt (MariaDB-Dienst)
    while (-not $DbPass) {
        $s1 = Read-Host "  DB-Passwort fuer 'azubiboard_user'" -AsSecureString
        $s2 = Read-Host "  Passwort bestaetigen" -AsSecureString
        $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
        $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
        if (-not $p1 -or $p1 -ne $p2) { Write-Host "  Passwoerter stimmen nicht / leer - nochmal." -ForegroundColor Red; continue }
        # Landet in SQL-Literalen ('...') und in der .env - Quotes/Backslash brechen beides
        if ($p1 -match "['`"\\]") { Write-Host "  Bitte ohne ' `" und \ - die brechen SQL und .env." -ForegroundColor Red; continue }
        $DbPass = $p1
    }
}

# Gilt auch fuer ein per -DbPass uebergebenes Passwort
if ($DbPass -match "['`"\\]") {
    Die "DB-Passwort enthaelt ' `" oder \ - das zerreisst das GRANT-Statement und die .env. Bitte anderes Passwort waehlen."
}

# Remote-DB kennt keine passwortlose Socket-Auth wie das lokale XAMPP-root
if ($dbRemote -and -not $DbRootPass -and -not $DryRun) {
    Die "Datenbank liegt auf $DbHost - dafuer wird das Passwort des Admin-Logins gebraucht: erneut mit -DbRootPass <pass> starten (oder -Interactive)."
}
# Bei Remote-DB gelten die GRANTs fuer die IP DIESES Servers - der Fallback
# 'localhost' waere aus Sicht des DB-Servers der falsche Host und der App-User
# kaeme nie rein (faellt sonst erst beim ersten Login der App auf).
if ($dbRemote -and $ServerIp -eq 'localhost') {
    Die "Server-IP konnte nicht ermittelt werden. Bei Datenbank auf $DbHost wird sie fuer die Rechtevergabe gebraucht: erneut mit -ServerIp <ip dieses servers> starten."
}

# Re-Run: bestehende Secrets aus vorhandener .env uebernehmen, sonst waeren
# nach jedem erneuten Lauf alle Sessions ungueltig (neues JWT_SECRET) und
# das DB-Passwort rotiert. Explizites -DbPass gewinnt weiterhin.
$jwtSecret = $null
if (Test-Path "$appPath\.env") {
    $oldEnv = Get-Content "$appPath\.env" -Raw
    if (-not $DbPass -and $oldEnv -match '(?m)^DB_PASS=(.+)$')    { $DbPass    = $Matches[1].Trim() }
    if ($oldEnv -match '(?m)^JWT_SECRET=(.+)$')                   { $jwtSecret = $Matches[1].Trim() }
    if ($DbPass -or $jwtSecret) { Info "Re-Run erkannt: DB-Pass/JWT-Secret aus bestehender .env uebernommen" }
}
if (-not $DbPass)    { $DbPass    = New-RandomSecret 24 }
if (-not $jwtSecret) { $jwtSecret = New-RandomSecret 64 }

$envContent = @"
VITE_BASE_PATH=/azubiboard/
VITE_USE_API=true

DB_HOST=$DbHost
DB_PORT=$DbPort
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
# APP_URL=http://$ServerIp/azubiboard   # Link in Digest-Mails

# KI-Features (Sprint 14 AI1-5): Claude-API-Schluessel eintragen,
# sonst antwortet /api/ai/* mit 503 (Features im UI deaktiviert).
# Holen bei https://console.anthropic.com -> API Keys
# CLAUDE_API_KEY=sk-ant-...
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
if (-not $dbRemote) {
    $mdbSvc = Get-Service $MYSQL_SVC -ErrorAction SilentlyContinue
    if ($mdbSvc -and $mdbSvc.Status -ne 'Running' -and -not $DryRun) { Start-Service $MYSQL_SVC; Start-Sleep -Seconds 2 }
}

# Admin-Auth zusammenbauen. Lokal: XAMPP-Standard root ohne Passwort.
# Remote: immer ueber TCP mit Host/Port/User.
$rootAuth = @('-u', $DbAdminUser)
if ($dbRemote) { $rootAuth = @('-h', $DbHost, '-P', "$DbPort") + $rootAuth }
if ($DbRootPass) { $rootAuth += "-p$DbRootPass" }

# Von wo darf der App-User verbinden? Lokal 'localhost', sonst die IP dieses Webservers.
$dbUserHost = if ($dbRemote) { $ServerIp } else { 'localhost' }

# Verbindung testen, bevor wir Schreiboperationen versuchen
if (-not (Test-Path $mysqlCli)) {
    if ($DryRun) { Info "mysql.exe fehlt (Trockenlauf ohne XAMPP) - Verbindungstest uebersprungen" }
    else { Die "mysql.exe nicht gefunden: $mysqlCli - XAMPP-Installation pruefen." }
} else {
    Invoke-Native { 'SELECT 1;' | & $mysqlCli @rootAuth --connect-timeout=10 2>$null | Out-Null }
    if ($LASTEXITCODE -ne 0) {
        if ($DryRun) { Info "MariaDB nicht erreichbar (laeuft im Trockenlauf evtl. nicht) - im echten Lauf wird der Dienst gestartet" }
        elseif ($dbRemote) {
            Die "Verbindung zu ${DbHost}:${DbPort} fehlgeschlagen. Pruefen: Zugangsdaten, bind-address auf dem DB-Server (nicht 127.0.0.1), Firewall Port $DbPort, und ob '$DbAdminUser' von $ServerIp aus verbinden darf."
        }
        else { Die "MariaDB-root-Login fehlgeschlagen. Hat root ein Passwort? Dann erneut mit -DbRootPass <pass> starten." }
    } else {
        Ok "DB-Admin-Verbindung: OK (${DbHost}:${DbPort})"
    }
}

$sqlSetup = @"
CREATE DATABASE IF NOT EXISTS azubiboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'azubiboard_user'@'$dbUserHost' IDENTIFIED BY '$DbPass';
ALTER USER 'azubiboard_user'@'$dbUserHost' IDENTIFIED BY '$DbPass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, LOCK TABLES ON azubiboard.* TO 'azubiboard_user'@'$dbUserHost';
FLUSH PRIVILEGES;
"@
if ($DryRun) {
    Dry "Datenbank 'azubiboard' + User 'azubiboard_user' anlegen (GRANTs)"
    foreach ($sqlName in @('setup.sql', 'azubiboard.sql', 'migrations\sprint12_phase2.sql')) {
        $srcSql = "$buildDir\database\$sqlName"
        if (Test-Path $srcSql) { Dry "Schema importieren: $sqlName" }
        else { Info "database\$sqlName nicht im Build-Ordner gefunden" }
    }
    Dry "Phase-2-Migration ausfuehren: php database\migrations\sprint12_phase2.php (idempotent)"
    if ($AdminEmail) { Dry "Rolle 'ausbilder' fuer '$AdminEmail' setzen (falls Account existiert)" }
} else {
    $sqlSetup | & $mysqlCli @rootAuth --connect-timeout=10
    if ($LASTEXITCODE -ne 0) { Die "Datenbank/User anlegen fehlgeschlagen - laeuft MariaDB auf ${DbHost}:${DbPort}?" }
    Ok "Datenbank 'azubiboard' und User 'azubiboard_user'@'$dbUserHost' angelegt"

    foreach ($sqlName in @('setup.sql', 'azubiboard.sql', 'migrations\sprint12_phase2.sql')) {
        $sqlFile = "$appPath\database\$sqlName"
        if (-not (Test-Path $sqlFile)) { Info "database\$sqlName nicht vorhanden - uebersprungen"; continue }
        # 'source' statt PowerShell-Pipe: mysql liest die Datei selbst (Encoding bleibt heil).
        # --force: bereits-vorhanden-Fehler einzelner Statements ueberspringen statt
        # abbrechen - azubiboard.sql kollidiert planmaessig mit setup.sql (users-PK);
        # ohne --force fehlten alle AUTO_INCREMENTs/FOREIGN KEYs hinter dem ersten Fehler.
        $srcPath = $sqlFile -replace '\\', '/'
        Invoke-Native { & $mysqlCli @rootAuth azubiboard --connect-timeout=10 --force --default-character-set=utf8mb4 -e "source $srcPath" 2>$null | Out-Null }
        if ($LASTEXITCODE -eq 0) { Ok "Schema importiert: $sqlName" }
        else { Info "${sqlName}: Import-Hinweis (Details: mysql -u root azubiboard -e ""source $srcPath"")" }
    }

    # Kanonische Phase-2-Migration (idempotent; gepflegt in database/migration_helpers.php).
    # Deckt Schema-Aenderungen ab, die die statische sprint12_phase2.sql nicht mehr kennt.
    $phase2 = "$appPath\database\migrations\sprint12_phase2.php"
    if ((Test-Path $phpExe) -and (Test-Path $phase2)) {
        Invoke-Native { & $phpExe $phase2 2>&1 | Out-Null }
        if ($LASTEXITCODE -eq 0) { Ok "Phase-2-Migration (PHP) angewendet" }
        else { Info "Phase-2-Migration meldete Fehler - manuell pruefen: php database\migrations\sprint12_phase2.php" }
    }

    # AdminEmail sofort setzen, falls der Account bereits existiert (Re-Run)
    if ($AdminEmail) {
        $safeMail = $AdminEmail -replace "'", "''"
        Invoke-Native { "UPDATE users SET role='ausbilder' WHERE email='$safeMail';" | & $mysqlCli @rootAuth azubiboard 2>$null | Out-Null }
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

# phpMyAdmin (XAMPP) auf den richtigen DB-Server zeigen lassen.
# XAMPP verdrahtet 127.0.0.1 + passwortloses root - liegt die DB auf einem
# eigenen Server, findet phpMyAdmin dort nichts. Statt die Default-Zeilen per
# Regex zu treffen, haengen wir einen markierten Override-Block ans Dateiende
# (spaetere Zuweisung gewinnt in PHP) - das ist idempotent und robust.
$pmaConf   = "$xamppPath\phpMyAdmin\config.inc.php"
$pmaMarker = '/* --- AzubiBoard: Datenbank-Server (vom Installer gesetzt) --- */'
if (-not (Test-Path $pmaConf)) {
    Info "phpMyAdmin-Konfiguration nicht gefunden - uebersprungen ($pmaConf)"
} else {
    $pma = Get-Content $pmaConf -Raw
    $idx = $pma.IndexOf($pmaMarker)
    if ($idx -ge 0) { $pma = $pma.Substring(0, $idx) }   # alten Block wegschneiden

    if ($dbRemote) {
        # Schliessendes '?>' muss weg, sonst landet der Block ausserhalb von PHP
        $pma = [regex]::Replace($pma.TrimEnd(), '\?>\s*$', '').TrimEnd()
        $pmaBlock = @"
$pmaMarker
`$cfg['Servers'][1]['host']            = '$DbHost';
`$cfg['Servers'][1]['port']            = '$DbPort';
`$cfg['Servers'][1]['connect_type']    = 'tcp';
`$cfg['Servers'][1]['socket']          = '';
`$cfg['Servers'][1]['auth_type']       = 'cookie';
`$cfg['Servers'][1]['verbose']         = 'AzubiBoard DB ($DbHost)';
`$cfg['Servers'][1]['AllowNoPassword'] = false;
`$cfg['Servers'][1]['user']            = '';
`$cfg['Servers'][1]['password']        = '';
"@
        $pmaNew = $pma + "`r`n`r`n" + $pmaBlock
    } else {
        $pmaNew = $pma.TrimEnd() + "`r`n"
    }

    if ($DryRun) {
        if ($dbRemote) { Dry "phpMyAdmin auf ${DbHost}:${DbPort} umstellen -> $pmaConf" }
        else           { Dry "phpMyAdmin auf XAMPP-Default belassen -> $pmaConf" }
    } else {
        if (-not (Test-Path "$pmaConf.azubiboard.bak")) { Copy-Item $pmaConf "$pmaConf.azubiboard.bak" }
        Set-Utf8NoBom $pmaConf $pmaNew
        if ($dbRemote) { Ok "phpMyAdmin zeigt auf ${DbHost}:${DbPort} (Login mit DB-Zugangsdaten)" }
        else           { Ok "phpMyAdmin nutzt die lokale Datenbank (XAMPP-Default)" }
    }
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
    # Backup-Skript enthaelt das DB-Passwort und die Dumps die kompletten Daten.
    # Unter C:\ erbt der Ordner sonst 'Users: Lesen' - Vererbung kappen und nur
    # SYSTEM + Administratoren zulassen (Pendant zu chmod 750 im Ubuntu-Installer).
    try {
        $acl = Get-Acl $backupDir
        $acl.SetAccessRuleProtection($true, $false)   # Vererbung aus, geerbte Regeln verwerfen
        foreach ($who in 'SYSTEM', 'Administrators') {
            $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
                $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
        }
        Set-Acl $backupDir $acl
        Ok "Backup-Ordner abgesichert (nur SYSTEM + Administratoren)"
    } catch {
        Info "ACL fuer $backupDir konnte nicht gesetzt werden: $_"
    }
    $backupScript = "$backupDir\azubiboard-backup.ps1"
    # Dump laeuft ueber den App-User (hat SELECT/LOCK TABLES auf azubiboard) - so
    # landet nicht das Admin-Passwort im Backup-Skript. Gleiches Vorgehen wie im
    # Ubuntu-Installer (/etc/mysql/azubiboard-backup.cnf).
    $dumpAuth = "'-u','azubiboard_user','-p$DbPass'"
    if ($dbRemote) { $dumpAuth = "'-h','$DbHost','-P','$DbPort'," + $dumpAuth }
    $bs = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$day  = Get-Date -Format 'yyyy-MM-dd'
`$sql  = '$backupDir\azubiboard_' + `$day + '.sql'
`$zip  = '$backupDir\azubiboard_' + `$day + '.zip'
# --result-file schreibt die Datei direkt (kein PowerShell-Pipe -> kein UTF-8-BOM, Umlaute bleiben heil)
`$dumpArgs = @($dumpAuth, '--single-transaction', "--result-file=`$sql", 'azubiboard')
& '$mysqlDump' @dumpArgs
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
    Stop-Log
    Write-Host ""
    exit 0
}
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Installation abgeschlossen!"              -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App-URL:     http://$ServerIp/azubiboard/" -ForegroundColor Cyan
Write-Host "  Datenbank:   ${DbHost}:${DbPort}  (User 'azubiboard_user'@'$dbUserHost')" -ForegroundColor Cyan
Write-Host "  phpMyAdmin:  http://localhost/phpmyadmin   (verbindet nach $DbHost)" -ForegroundColor Cyan
Write-Host "  DB-Backups:  $backupDir  (taegl. 03:00, 30 Tage)" -ForegroundColor Cyan
if ($dbRemote) {
    Write-Host "  Dienste:     Apache laeuft als Autostart-Dienst (DB liegt auf $DbHost)" -ForegroundColor Cyan
} else {
    Write-Host "  Dienste:     Apache + MariaDB laufen als Autostart-Dienste" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Naechste Schritte:" -ForegroundColor Yellow
Write-Host "   1. http://$ServerIp/azubiboard/ oeffnen + Account registrieren"
Write-Host "   2. Ausbilder-Rolle setzen:"
# Passwort bewusst NICHT ausgeben (-p fragt interaktiv nach)
$hintAuth = if ($dbRemote) { "-h $DbHost -P $DbPort -u $DbAdminUser -p" } else { "-u $DbAdminUser" }
Write-Host "      & '$mysqlCli' $hintAuth azubiboard -e `"UPDATE users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';`"" -ForegroundColor White
Stop-Log
Wait-Taste
exit 0
