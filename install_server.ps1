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
    -WebPort <port>       Port fuer die App (Default 80; ist 80 fremd belegt,
                          wird automatisch auf 8080ff. ausgewichen)
    -SelbsttestNur        NICHTS installieren, nur pruefen ob die Anwendung
                          laeuft (Frontend, API, .env-Sperre, DB-Zugang).
                          Braucht keine Adminrechte - jederzeit aufrufbar.
    -NoPause              am Ende nicht auf Tastendruck warten (fuer Automatik)

  AUF EINEM SERVER MIT VORHANDENER SOFTWARE:
    Der Installer weicht aus, statt fremde Dienste umzubiegen -
    belegte Ports 80/443/3306 (Apache startet sonst GAR NICHT, auch nicht
    auf einem anderen HTTP-Port!), fremde Dienste namens 'Apache2.4'/'mysql',
    fremde <Directory>-Bloecke in der httpd.conf. Was er anfasst, sichert er
    vorher als <datei>.azubiboard.bak.

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
    [int]$WebPort = 0,
    [switch]$SkipXampp,
    [switch]$SkipBackupTask,
    [switch]$DryRun,
    [switch]$NoPause,
    [switch]$SelbsttestNur
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

# ── Koexistenz auf einem belegten Server ─────────────────────
# Der Zielserver ist KEINE frische Maschine: IIS oder ein anderer Webserver
# koennen auf 80 liegen, ein fremdes MySQL auf 3306, und die Dienstnamen
# 'Apache2.4'/'mysql' koennen von fremder Software stammen. Nichts davon darf
# der Installer anfassen - er weicht aus, statt fremde Dienste umzukonfigurieren.

function Get-PortBesitzer([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { return $null }
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    # Pfad zuerst ueber CIM: Get-Process.Path wirft/liefert leer, sobald der
    # Prozess einem anderen Konto gehoert (auf einem Server der Normalfall -
    # fremde Dienste laufen als SYSTEM oder Dienstkonto). Ohne den Pfad haelt
    # der Installer den eigenen XAMPP-Prozess faelschlich fuer fremde Software.
    $pfad = $null
    try { $pfad = (Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue).ExecutablePath } catch { }
    if (-not $pfad -and $p) { try { $pfad = $p.Path } catch { } }
    [pscustomobject]@{
        Pid  = $c.OwningProcess
        Name = if ($p) { $p.ProcessName } else { "PID $($c.OwningProcess)" }
        Pfad = $pfad
    }
}

# Gehoert der Lauscher zu UNSERER XAMPP-Installation? Dann ist der Port nicht
# "belegt", sondern laeuft schon richtig.
function Test-UnserProzess($Besitzer) {
    if (-not $Besitzer) { return $false }
    if ($Besitzer.Pfad) { return $Besitzer.Pfad -like "$xamppPath*" }
    # Ohne Adminrechte ist der Pfad eines fremden Prozesses nicht lesbar (weder
    # ueber Get-Process noch ueber CIM - beides nachgestellt). Dann ueber die
    # Dienste gehen: laeuft der Prozess als einer UNSERER XAMPP-Dienste?
    foreach ($svc in @($APACHE_SVC, $MYSQL_SVC, 'Apache2.4', 'mysql')) {
        $s = Get-CimInstance Win32_Service -Filter "Name='$svc'" -ErrorAction SilentlyContinue
        if ($s -and $s.ProcessId -eq $Besitzer.Pid -and $s.PathName -and $s.PathName.Replace('"','') -like "$xamppPath*") {
            return $true
        }
    }
    return $false
}

function Get-FreierPort([int[]]$Kandidaten) {
    foreach ($p in $Kandidaten) { if (-not (Get-PortBesitzer $p)) { return $p } }
    return 0
}

# Zeigt ein vorhandener Dienst auf unser XAMPP - oder ist es fremde Software,
# die zufaellig so heisst? Set-Service/Restart-Service auf einen fremden Dienst
# waere ein Uebergriff (und wuerde den fremden Dienst evtl. neu starten).
function Test-EigenerDienst([string]$Name) {
    $s = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
    if (-not $s) { return $null }        # gibt es nicht
    $pfad = $s.PathName
    if ($pfad -and $pfad.Replace('"','') -like "$xamppPath*") { return $true }
    return $false                        # existiert, gehoert aber nicht uns
}

# Freien Dienstnamen finden, wenn der Wunschname fremd belegt ist
function Get-FreierDienstName([string]$Wunsch, [string]$Ersatz) {
    $eigen = Test-EigenerDienst $Wunsch
    if ($null -eq $eigen -or $eigen -eq $true) { return $Wunsch }
    $eigen2 = Test-EigenerDienst $Ersatz
    if ($null -eq $eigen2 -or $eigen2 -eq $true) { return $Ersatz }
    return $Ersatz
}

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

# Kontogruppen NUR ueber ihre SID ansprechen. Auf einem deutschen Windows
# heissen sie "Benutzer"/"Administratoren" - 'Users'/'Administrators' werfen dort
# IdentityNotMappedException (nachgestellt auf de-DE). Die betroffenen Stellen
# stecken in try/catch, es waere also still danebengegangen: uploads/ ohne
# Schreibrecht (kein Avatar-Upload) und der Backup-Ordner mit dem Klartext-
# DB-Passwort ohne die vorgesehene Einschraenkung.
$SID_USERS  = 'S-1-5-32-545'   # VORDEFINIERT\Benutzer
$SID_ADMINS = 'S-1-5-32-544'   # VORDEFINIERT\Administratoren
$SID_SYSTEM = 'S-1-5-18'       # NT-AUTORITAET\SYSTEM
function New-AclRule([string]$Sid, [string]$Rechte) {
    New-Object System.Security.AccessControl.FileSystemAccessRule(
        (New-Object System.Security.Principal.SecurityIdentifier($Sid)),
        $Rechte, 'ContainerInherit,ObjectInherit', 'None', 'Allow')
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

# Trockenlauf und reiner Selbsttest aendern nichts am System und brauchen
# deshalb auch keine Adminrechte - sie wuerden sonst in einem zweiten Fenster
# landen, dessen Ausgabe niemand sieht.
if (-not $isAdmin -and -not $DryRun -and -not $SelbsttestNur) {
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
    # Ohne diese Zeile ginge ein ausdruecklich gesetzter Port beim Neustart
    # verloren und die elevierte Instanz liefe wieder gegen den belegten Port 80.
    if ($PSBoundParameters.ContainsKey('WebPort')) { $argList += @('-WebPort', $WebPort) }
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

# Server-IP frueh festlegen - Ports, .env (ALLOWED_ORIGIN), GRANTs und der
# Selbsttest am Ende haengen daran.
# Ein Arbeitsserver hat oft mehrere Netzwerkkarten (Management, Backup, iSCSI,
# Hyper-V-Switch). "die erste IPv4" traf davon irgendeine - richtig ist die,
# ueber die die Standardroute laeuft, denn ueber die kommen auch die Clients.
if (-not $ServerIp) {
    try {
        $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
                 Sort-Object RouteMetric, ifMetric | Select-Object -First 1
        if ($route) {
            $ServerIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.ifIndex -ErrorAction SilentlyContinue |
                         Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
        }
    } catch { }
}
if (-not $ServerIp) {
    $ServerIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -First 1).IPAddress
}
if (-not $ServerIp) { $ServerIp = 'localhost' }

# Bei -Interactive den DB-Host HIER erfragen (nach der Elevation, vor Schritt 2):
# Schritt 2 entscheidet anhand von $dbRemote, ob der lokale MariaDB-Dienst
# registriert wird. Kaeme die Frage erst in Schritt 7, liefe dieser Dienst
# laengst und belegte Port 3306, obwohl die Datenbank woanders liegt.
if ($Interactive) {
    Write-Host ""
    $inIp = Read-Host "  Server-IP [$ServerIp]"
    if ($inIp) { $ServerIp = $inIp }
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

function Invoke-Selbsttest {
    $basis    = "http://127.0.0.1:$WebPort/azubiboard"
    $probleme = @()

    # Bewusst HttpWebRequest statt Invoke-WebRequest: bei Fehlerstatus (403/404)
    # wirft Invoke-WebRequest, und der Antworttext ist dann je nach PowerShell-
    # Version nicht mehr lesbar - der Selbsttest haette einen korrekt
    # antwortenden API-Router als "nicht erreichbar" gemeldet (nachgestellt).
    function Test-Url([string]$Url, [int]$Timeout = 15) {
        $resp = $null
        try {
            $req = [System.Net.HttpWebRequest]::Create($Url)
            $req.Timeout           = $Timeout * 1000
            $req.ReadWriteTimeout  = $Timeout * 1000
            $req.AllowAutoRedirect = $false
            $req.UserAgent         = 'AzubiBoard-Installer'
            try { $resp = $req.GetResponse() }
            catch [System.Net.WebException] {
                $resp = $_.Exception.Response
                if (-not $resp) { return [pscustomobject]@{ Code = 0; Text = ''; Fehler = $_.Exception.Message } }
            }
            $code = [int]$resp.StatusCode
            $text = ''
            try {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $text = $sr.ReadToEnd()
                $sr.Close()
            } catch { }
            return [pscustomobject]@{ Code = $code; Text = $text; Fehler = $null }
        } catch {
            return [pscustomobject]@{ Code = 0; Text = ''; Fehler = $_.Exception.Message }
        } finally {
            if ($resp) { try { $resp.Close() } catch { } }
        }
    }

    # 1) Frontend
    $r1 = Test-Url "$basis/"
    $webErreichbar = $r1.Code -ne 0
    if ($r1.Code -eq 200 -and $r1.Text -match 'id="root"') { Ok "Frontend antwortet (HTTP 200)" }
    elseif ($r1.Code -eq 200) { Ok "Frontend antwortet (HTTP 200)"; $probleme += "Die Startseite sieht untypisch aus - stammt sie wirklich aus dist/?" }
    elseif ($r1.Code -eq 0)   { $probleme += "Keine Antwort auf $basis/ ($($r1.Fehler)). Laeuft der Dienst '$APACHE_SVC'? Port $WebPort belegt?" }
    else                      { $probleme += "Frontend antwortet mit HTTP $($r1.Code) statt 200." }

    # Antwortet der Webserver gar nicht, sagen die naechsten Pruefungen NICHTS
    # aus. Sie wuerden sonst "HTTP 0" als "ist ja gesperrt" durchgehen lassen -
    # eine falsche Entwarnung genau bei der wichtigsten Frage (.env im Netz).
    if (-not $webErreichbar) {
        Info "Weitere HTTP-Pruefungen uebersprungen - der Webserver antwortet nicht"
    } else {

    # 2) API + PHP (unbekannte Route -> JSON-Fehler aus unserem Router)
    $r2 = Test-Url "$basis/api/"
    if ($r2.Text -match 'Unbekannte Route') { Ok "API und PHP laufen (Router antwortet)" }
    elseif ($r2.Text -match '<\?php')       { $probleme += "PHP wird NICHT ausgefuehrt - der Quelltext wird ausgeliefert. php-Modul in httpd.conf pruefen." }
    elseif ($r2.Code -eq 500)               { $probleme += "API antwortet mit HTTP 500 - Details in $xamppPath\apache\logs\error.log" }
    elseif ($r2.Code -eq 404)               { $probleme += "API nicht erreichbar (404). Fehlt api/.htaccess oder greift AllowOverride nicht?" }
    else                                    { $probleme += "API antwortet unerwartet (HTTP $($r2.Code))." }

    # 3) .env darf NICHT ausgeliefert werden (enthaelt DB-Passwort + JWT-Secret)
    $r3 = Test-Url "$basis/.env"
    if ($r3.Code -eq 200 -and $r3.Text -match 'DB_PASS|JWT_SECRET') {
        $probleme += "SCHWER: $basis/.env ist im Browser abrufbar (DB-Passwort + JWT-Secret!). AllowOverride greift nicht - <Directory>-Block in httpd.conf pruefen."
    } elseif ($r3.Code -eq 200) {
        $probleme += "SCHWER: $basis/.env wird ausgeliefert (HTTP 200) - <Directory>-Block in httpd.conf pruefen."
    } else { Ok ".env ist nicht abrufbar (HTTP $($r3.Code))" }

    # 4) vendor/ darf nicht ausgeliefert werden
    if (Test-Path "$appPath\vendor\autoload.php") {
        $r4 = Test-Url "$basis/vendor/autoload.php"
        if ($r4.Code -eq 200) { $probleme += "vendor/ ist ueber den Browser erreichbar - <Directory>-Sperre in httpd.conf pruefen." }
        else { Ok "vendor/ ist gesperrt (HTTP $($r4.Code))" }
    }

    }  # Ende: Webserver erreichbar

    # 5) DB-Zugang GENAU so, wie die App ihn nutzt (.env -> config.php -> PDO)
    if (Test-Path $phpExe) {
        $prueferPfad = "$env:TEMP\azubiboard-dbcheck.php"
        # Achtung: im Here-String muss $ mit Backtick escaped werden, nicht mit
        # Backslash - sonst landet ein "\$e" im PHP und der Pruefer selbst hat
        # einen Syntaxfehler (genau so passiert).
        Set-Utf8NoBom $prueferPfad @"
<?php
require_once '$($appPath -replace '\\','/')/api/config.php';
try { db()->query('SELECT 1'); echo 'DBOK'; }
catch (Throwable `$e) { echo 'DBFEHLER: ' . `$e->getMessage(); }
"@
        $dbAntwort = Invoke-Native { & $phpExe $prueferPfad 2>&1 | Out-String }

        # Selbstheilung: laeuft der Server mit skip-name-resolve (oder umgekehrt),
        # passt eine der beiden Schreibweisen nicht. Statt zu scheitern die .env
        # auf die andere umstellen und erneut pruefen.
        if ($dbAntwort -notmatch 'DBOK' -and -not $dbRemote) {
            $andere = if ($dbConnHost -eq '127.0.0.1') { 'localhost' } else { '127.0.0.1' }
            $envAlt = Get-Content "$appPath\.env" -Raw
            $envNeu = $envAlt -replace '(?m)^DB_HOST=.*$', "DB_HOST=$andere"
            Set-Utf8NoBom "$appPath\.env" $envNeu
            $zweit = Invoke-Native { & $phpExe $prueferPfad 2>&1 | Out-String }
            if ($zweit -match 'DBOK') {
                $dbAntwort = $zweit
                Info "DB_HOST in der .env auf '$andere' korrigiert (die andere Schreibweise wurde abgewiesen)"
            } else {
                Set-Utf8NoBom "$appPath\.env" $envAlt   # nichts verschlimmbessern
            }
        }
        Remove-Item $prueferPfad -ErrorAction SilentlyContinue
        if ($dbAntwort -match 'DBOK') { Ok "Datenbank-Zugang der App funktioniert (.env + PDO)" }
        else { $probleme += "Die App kommt nicht an die Datenbank: $($dbAntwort.Trim())" }
    }

    if ($probleme.Count -eq 0) {
        Ok "Selbsttest bestanden - die Anwendung laeuft"
        return $true
    }
    Write-Host ""
    Write-Host "  ACHTUNG - der Selbsttest hat Probleme gefunden:" -ForegroundColor Red
    foreach ($p in $probleme) { Write-Host "   - $p" -ForegroundColor Red }
    return $false
}

# ── 0. Umgebung pruefen: was ist hier schon belegt? ──────────
# Muss VOR allem anderen laufen: die .env (Schritt 7) und die Apache-Config
# (Schritt 9) brauchen die endgueltigen Ports, und Schritt 2 darf keinen
# fremden Dienst anfassen.
Hdr "0/11 Umgebung pruefen (belegte Ports, fremde Dienste)"

# --- Webserver-Port ---
$webPortGewuenscht = if ($WebPort -gt 0) { $WebPort } else { 80 }
$besitzer = Get-PortBesitzer $webPortGewuenscht
if (-not $besitzer) {
    $WebPort = $webPortGewuenscht
    Ok "Port $WebPort ist frei"
} elseif (Test-UnserProzess $besitzer) {
    $WebPort = $webPortGewuenscht
    Ok "Port $WebPort wird bereits von diesem XAMPP bedient ($($besitzer.Name))"
} elseif ($PSBoundParameters.ContainsKey('WebPort')) {
    # Ausdruecklicher Wunsch des Anwenders: nicht eigenmaechtig ausweichen
    Info "Port $WebPort ist von '$($besitzer.Name)' belegt - trotzdem verwendet (ausdruecklich gesetzt)."
    Info "  Apache wird nicht starten koennen, solange der Port belegt ist."
} else {
    $WebPort = Get-FreierPort @(8080, 8081, 8082, 8088, 8090, 8000)
    if ($WebPort -eq 0) { Die "Port 80 ist von '$($besitzer.Name)' belegt und keiner der Ausweich-Ports (8080/8081/8082/8088/8090/8000) ist frei. Bitte mit -WebPort <freier port> starten." }
    Info "Port 80 ist von '$($besitzer.Name)' belegt (z.B. IIS) - AzubiBoard laeuft auf Port $WebPort"
    Info "  (Apache wird NICHT auf 80 gezwungen; der fremde Dienst bleibt unberuehrt)"
}

# --- HTTPS-Port: der stille Killer ---
# XAMPP laedt conf/extra/httpd-ssl.conf mit 'Listen 443'. Ist 443 belegt (IIS
# belegt in aller Regel 80 UND 443), bricht Apache den Start KOMPLETT ab -
# "no listening sockets available, shutting down" - und zwar egal, welchen
# HTTP-Port wir gewaehlt haben. Nachgestellt und im error.log belegt.
$sslConf = "$xamppPath\apache\conf\extra\httpd-ssl.conf"
$SslPort = 443
$sslBesitzer = Get-PortBesitzer 443
if ($sslBesitzer -and -not (Test-UnserProzess $sslBesitzer)) {
    $SslPort = Get-FreierPort @(8443, 8444, 4443, 9443)
    if ($SslPort -eq 0) {
        Info "Port 443 ist von '$($sslBesitzer.Name)' belegt und kein Ausweich-Port frei - HTTPS-Lauscher wird abgeschaltet"
        $SslPort = -1   # -> Listen 443 wird auskommentiert
    } else {
        Info "Port 443 ist von '$($sslBesitzer.Name)' belegt - Apache lauscht fuer HTTPS auf $SslPort"
        Info "  (sonst wuerde Apache GAR NICHT starten, auch nicht auf Port $WebPort)"
    }
} elseif ($sslBesitzer) {
    Ok "Port 443 wird bereits von diesem XAMPP bedient"
} else {
    Ok "Port 443 ist frei"
}

# --- Datenbank-Port (nur bei lokaler DB relevant) ---
if (-not $dbRemote) {
    $dbBesitzer = Get-PortBesitzer $DbPort
    if ($dbBesitzer -and -not (Test-UnserProzess $dbBesitzer) -and -not $PSBoundParameters.ContainsKey('DbPort')) {
        $neu = Get-FreierPort @(3307, 3308, 3309, 3310)
        if ($neu -eq 0) { Die "Port $DbPort ist von '$($dbBesitzer.Name)' belegt und 3307-3310 sind es auch. Bitte mit -DbPort <freier port> starten." }
        Info "Port $DbPort ist von '$($dbBesitzer.Name)' belegt - eigene MariaDB laeuft auf Port $neu"
        $DbPort = $neu
        $dbPortGeaendert = $true
    } elseif ($dbBesitzer -and (Test-UnserProzess $dbBesitzer)) {
        Ok "MariaDB dieser XAMPP-Installation laeuft bereits auf Port $DbPort"
    } elseif ($dbBesitzer) {
        Info "Port $DbPort ist von '$($dbBesitzer.Name)' belegt - wird trotzdem verwendet (ausdruecklich gesetzt)"
    } else {
        Ok "Port $DbPort ist frei"
    }
}

# --- Dienstnamen: fremde Dienste gleichen Namens nicht anfassen ---
foreach ($paar in @(@{ Var = 'APACHE_SVC'; Wunsch = 'Apache2.4'; Ersatz = 'AzubiBoardApache' },
                    @{ Var = 'MYSQL_SVC';  Wunsch = 'mysql';     Ersatz = 'AzubiBoardMariaDB' })) {
    $ist = Test-EigenerDienst $paar.Wunsch
    if ($ist -eq $false) {
        $neu = Get-FreierDienstName $paar.Wunsch $paar.Ersatz
        Set-Variable -Name $paar.Var -Value $neu -Scope Script
        Info "Dienst '$($paar.Wunsch)' gehoert fremder Software - eigener Dienst heisst '$neu'"
    } elseif ($ist -eq $true) {
        Ok "Dienst '$($paar.Wunsch)' gehoert zu diesem XAMPP"
    }
}

$appUrlBasis = if ($WebPort -eq 80) { "http://$ServerIp" } else { "http://${ServerIp}:$WebPort" }

# Verbindungsziel fuer .env, mysql-Aufrufe und Backup. Lokal bewusst 127.0.0.1
# statt 'localhost': Windows loest localhost zuerst nach ::1 auf, was jede
# einzelne Datenbankverbindung um rund zwei Sekunden verzoegert. Falls der
# Server nur 'localhost' akzeptiert, korrigiert der Selbsttest das am Ende.
$dbConnHost = if ($dbRemote) { $DbHost } else { '127.0.0.1' }

# Nur pruefen, nichts installieren (-SelbsttestNur): laesst sich jederzeit
# aufrufen, um zu sehen ob die Anwendung noch laeuft - auch Monate spaeter.
if ($SelbsttestNur) {
    Hdr "Selbsttest (ohne Installation)"
    $bestanden = Invoke-Selbsttest
    Stop-Log
    Wait-Taste
    exit $(if ($bestanden) { 0 } else { 1 })
}

# ── 1. XAMPP sicherstellen ───────────────────────────────────
Hdr "1/11 XAMPP (Apache + PHP + MariaDB)"
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
Hdr "2/11 Apache + MariaDB als Windows-Dienste"

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

# Weicht die eigene MariaDB einem fremden Dienst auf 3306 aus, muss der neue
# Port in my.ini stehen - sonst startet sie wieder gegen den belegten Port.
if ($dbPortGeaendert) {
    $myIni = "$xamppPath\mysql\bin\my.ini"
    if (Test-Path $myIni) {
        if (-not (Test-Path "$myIni.azubiboard.bak")) { Copy-Item $myIni "$myIni.azubiboard.bak" }
        $ini = Get-Content $myIni -Raw
        # nur die 'port='-Zeilen in [client] und [mysqld], nichts anderes
        $ini = [regex]::Replace($ini, '(?m)^\s*port\s*=\s*\d+\s*$', "port=$DbPort")
        Set-Utf8NoBom $myIni $ini
        Ok "my.ini auf Port $DbPort gesetzt (Sicherung: my.ini.azubiboard.bak)"
    } else {
        Info "my.ini nicht gefunden - MariaDB laeuft evtl. weiter auf 3306"
    }
}

$mdbEigen = Test-EigenerDienst $MYSQL_SVC
if ($mdbEigen -eq $false) {
    # Sollte nach Schritt 0 nicht mehr vorkommen - aber niemals einen fremden
    # Dienst umkonfigurieren oder neu starten.
    Die "Dienst '$MYSQL_SVC' gehoert fremder Software. Bitte mit einem anderen Dienstnamen arbeiten (Skript erneut starten) - es wurde nichts veraendert."
}
if ($null -eq $mdbEigen) {
    Info "MariaDB-Dienst '$MYSQL_SVC' wird registriert..."
    & $mysqlExe --install $MYSQL_SVC "--defaults-file=$xamppPath\mysql\bin\my.ini" | Out-Null
    Start-Sleep -Seconds 2
}
if (Get-Service -Name $MYSQL_SVC -ErrorAction SilentlyContinue) {
    Set-Service -Name $MYSQL_SVC -StartupType Automatic
    if ((Get-Service $MYSQL_SVC).Status -ne 'Running') { Start-Service $MYSQL_SVC }
    elseif ($dbPortGeaendert) { Restart-Service $MYSQL_SVC }   # neuer Port greift erst nach Neustart
    Ok "MariaDB-Dienst '$MYSQL_SVC' laeuft (Autostart, Port $DbPort)"
} else {
    Die "MariaDB-Dienst konnte nicht registriert werden."
}
}

# Apache-Dienst
$apEigen = Test-EigenerDienst $APACHE_SVC
if ($apEigen -eq $false) {
    Die "Dienst '$APACHE_SVC' gehoert fremder Software (z.B. ein anderer Apache). Es wurde nichts veraendert - Skript erneut starten, dann wird ein eigener Dienstname verwendet."
}
if ($null -eq $apEigen) {
    Info "Apache-Dienst '$APACHE_SVC' wird registriert..."
    & $apacheExe -k install -n $APACHE_SVC | Out-Null
    Start-Sleep -Seconds 2
}
if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) {
    Set-Service -Name $APACHE_SVC -StartupType Automatic
    Ok "Apache-Dienst '$APACHE_SVC' registriert (Autostart)"
} else {
    Info "Apache-Dienst nicht registriert - wird nach Konfiguration erneut versucht."
}

}  # Ende DryRun-Guard Abschnitt 2

# ── 3. Node.js sicherstellen ─────────────────────────────────
Hdr "3/11 Node.js (fuer den Frontend-Build)"

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
Hdr "4/11 Frontend bauen (npm ci + build)"
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
Hdr "5/11 PHP konfigurieren + Composer"
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
Hdr "6/11 Dateien nach $appPath deployen"
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
# Zweite Absicherung fuer vendor/ und database/ (die httpd.conf-Sperre ist die
# erste): PHP-Bibliotheken und das DB-Schema gehoeren nie ins Web. Greift auch
# dort, wo AllowOverride erlaubt, aber der <Directory>-Block verlorenging.
$denyHtaccess = "# AzubiBoard: nie ausliefern`r`nRequire all denied`r`n"
robocopy "$buildDir\dist"     $appPath          /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$buildDir\api"      "$appPath\api"    /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$buildDir\database" "$appPath\database" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if (Test-Path "$buildDir\vendor") {
    robocopy "$buildDir\vendor" "$appPath\vendor" /E /NFL /NDL /NJH /NJS /NP | Out-Null
}
Copy-Item "$buildDir\composer.json" $appPath -Force -ErrorAction SilentlyContinue
Copy-Item "$buildDir\composer.lock" $appPath -Force -ErrorAction SilentlyContinue
foreach ($gesperrt in 'database', 'vendor') {
    if (Test-Path "$appPath\$gesperrt") { Set-Utf8NoBom "$appPath\$gesperrt\.htaccess" $denyHtaccess }
}
if (-not (Test-Path "$appPath\index.html")) { Die "Deploy unvollstaendig - index.html fehlt in $appPath." }
Ok "Frontend, API, DB-Schema und vendor/ deployed (database/ + vendor/ gesperrt)"

# uploads/ beschreibbar machen (Apache-Prozess laeuft als lokaler Dienst)
try {
    $acl = Get-Acl "$appPath\uploads"
    $acl.SetAccessRule((New-AclRule $SID_USERS 'Modify'))
    Set-Acl "$appPath\uploads" $acl
    Ok "uploads/ beschreibbar"
} catch {
    Info "uploads/-Rechte manuell setzen: Eigenschaften -> Sicherheit -> Benutzer: Aendern ($_)"
}

}  # Ende DryRun-Guard Abschnitt 6

# ── 7. .env erstellen ────────────────────────────────────────
Hdr "7/11 Konfiguration (.env)"
if ($Interactive) {
    Write-Host ""
    # Server-IP, DB-Host/Port/Admin wurden bereits vor Schritt 0 abgefragt -
    # die Ports/Dienste in Schritt 0 und die .env haengen davon ab.
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

DB_HOST=$dbConnHost
DB_PORT=$DbPort
DB_NAME=azubiboard
DB_USER=azubiboard_user
DB_PASS=$DbPass

JWT_SECRET=$jwtSecret
JWT_EXPIRY=604800

ALLOWED_ORIGIN=$appUrlBasis

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
# APP_URL=$appUrlBasis/azubiboard   # Link in Digest-Mails

# KI-Features (Sprint 14 AI1-5): Claude-API-Schluessel eintragen,
# sonst antwortet /api/ai/* mit 503 (Features im UI deaktiviert).
# Holen bei https://console.anthropic.com -> API Keys
# CLAUDE_API_KEY=sk-ant-...
"@
if ($DryRun) {
    $dryEnv = "$buildDir\.env.dryrun"
    if (Test-Path $buildDir) { Set-Utf8NoBom $dryEnv $envContent; Dry ".env nach $appPath schreiben (Beispiel hier: $dryEnv)" }
    else { Dry ".env nach $appPath schreiben (ALLOWED_ORIGIN=$appUrlBasis)" }
} else {
    Set-Utf8NoBom "$appPath\.env" $envContent
    Ok ".env erstellt (ALLOWED_ORIGIN=$appUrlBasis)"
    if (-not $Interactive) { Info "DB-Pass + JWT-Secret automatisch generiert (in .env nachschlagbar)" }
}

# ── 8. Datenbank einrichten ──────────────────────────────────
Hdr "8/11 Datenbank einrichten"
if (-not $dbRemote) {
    $mdbSvc = Get-Service $MYSQL_SVC -ErrorAction SilentlyContinue
    if ($mdbSvc -and $mdbSvc.Status -ne 'Running' -and -not $DryRun) { Start-Service $MYSQL_SVC; Start-Sleep -Seconds 2 }
}

# Admin-Auth zusammenbauen. IMMER mit Host UND Port - ohne '-P' landete der
# Client auf dem Standard-Port 3306, und wenn dort ein FREMDES MySQL liegt,
# haette der Installer Datenbank und Benutzer in der fremden Instanz angelegt.
# 127.0.0.1 statt localhost: erzwingt IPv4/TCP (localhost laeuft unter Windows
# erst in ::1 und kostet je Aufruf rund zwei Sekunden).
$rootAuth = @('-h', $dbConnHost, '-P', "$DbPort", '-u', $DbAdminUser)
if ($DbRootPass) { $rootAuth += "-p$DbRootPass" }

# Von wo darf der App-User verbinden? Lokal deckt 'localhost' + '127.0.0.1' ab
# (MySQL unterscheidet die beiden bei GRANTs, und je nach skip-name-resolve
# sieht der Server die eine oder die andere Schreibweise).
$dbUserHosts = if ($dbRemote) { @($ServerIp) } else { @('localhost', '127.0.0.1') }
$dbUserHost  = $dbUserHosts[0]

# Verbindung testen, bevor wir Schreiboperationen versuchen
if (-not (Test-Path $mysqlCli)) {
    if ($DryRun) { Info "mysql.exe fehlt (Trockenlauf ohne XAMPP) - Verbindungstest uebersprungen" }
    else { Die "mysql.exe nicht gefunden: $mysqlCli - XAMPP-Installation pruefen." }
} else {
    Invoke-Native { 'SELECT 1;' | & $mysqlCli @rootAuth --connect-timeout=10 2>$null | Out-Null }
    # Zweiter Versuch ueber 'localhost': greift, wenn der Server mit
    # skip-name-resolve laeuft und root nur als 'root'@'localhost' existiert.
    if ($LASTEXITCODE -ne 0 -and -not $dbRemote) {
        $altAuth = @('-h', 'localhost', '-P', "$DbPort", '-u', $DbAdminUser)
        if ($DbRootPass) { $altAuth += "-p$DbRootPass" }
        Invoke-Native { 'SELECT 1;' | & $mysqlCli @altAuth --connect-timeout=10 2>$null | Out-Null }
        if ($LASTEXITCODE -eq 0) { $rootAuth = $altAuth; $dbConnHost = 'localhost'; Info "DB-Verbindung ueber 'localhost' statt 127.0.0.1" }
    }
    if ($LASTEXITCODE -ne 0) {
        if ($DryRun) { Info "MariaDB nicht erreichbar (laeuft im Trockenlauf evtl. nicht) - im echten Lauf wird der Dienst gestartet" }
        elseif ($dbRemote) {
            Die "Verbindung zu ${DbHost}:${DbPort} fehlgeschlagen. Pruefen: Zugangsdaten, bind-address auf dem DB-Server (nicht 127.0.0.1), Firewall Port $DbPort, und ob '$DbAdminUser' von $ServerIp aus verbinden darf."
        }
        else { Die "MariaDB-root-Login auf ${dbConnHost}:${DbPort} fehlgeschlagen. Hat root ein Passwort? Dann erneut mit -DbRootPass <pass> starten. Laeuft der Dienst '$MYSQL_SVC'?" }
    } else {
        Ok "DB-Admin-Verbindung: OK (${dbConnHost}:${DbPort})"
    }
}

$sqlSetup = "CREATE DATABASE IF NOT EXISTS azubiboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`n"
foreach ($h in $dbUserHosts) {
    $sqlSetup += @"
CREATE USER IF NOT EXISTS 'azubiboard_user'@'$h' IDENTIFIED BY '$DbPass';
ALTER USER 'azubiboard_user'@'$h' IDENTIFIED BY '$DbPass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, LOCK TABLES ON azubiboard.* TO 'azubiboard_user'@'$h';

"@
}
$sqlSetup += "FLUSH PRIVILEGES;`n"
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
Hdr "9/11 Apache konfigurieren + Firewall"
if (Test-Path $apacheConf) {
    if (-not $DryRun -and -not (Test-Path "$apacheConf.azubiboard.bak")) { Copy-Item $apacheConf "$apacheConf.azubiboard.bak" }
    $conf = Get-Content $apacheConf -Raw
    $changed = $false

    # Module aktivieren (ohne die reicht weder das SPA-Routing noch die CSP)
    if ($conf -match '(?m)^#LoadModule rewrite_module') { $conf = $conf -replace '(?m)^#LoadModule rewrite_module', 'LoadModule rewrite_module'; $changed = $true; Ok "mod_rewrite aktiviert" } else { Ok "mod_rewrite aktiv" }
    if ($conf -match '(?m)^#LoadModule headers_module') { $conf = $conf -replace '(?m)^#LoadModule headers_module', 'LoadModule headers_module'; $changed = $true; Ok "mod_headers aktiviert" } else { Ok "mod_headers aktiv" }

    # Lauscht Apache schon woanders? 'Listen 80' nur anfassen, wenn wir wegen
    # eines fremden Dienstes ausweichen mussten - sonst bleibt fremde
    # Konfiguration unberuehrt.
    if ($WebPort -ne 80 -and $conf -match '(?m)^\s*Listen\s+80\s*$') {
        $conf = [regex]::Replace($conf, '(?m)^(\s*)Listen\s+80\s*$', "`$1Listen $WebPort")
        $changed = $true
        Ok "Apache lauscht auf Port $WebPort (Port 80 ist fremd belegt)"
    }

    # HTTPS-Lauscher umlegen/abschalten, sonst verhindert ein belegter Port 443
    # den Start des gesamten Webservers (siehe Schritt 0).
    if ($SslPort -ne 443 -and (Test-Path $sslConf)) {
        if (-not $DryRun -and -not (Test-Path "$sslConf.azubiboard.bak")) { Copy-Item $sslConf "$sslConf.azubiboard.bak" }
        $ssl = Get-Content $sslConf -Raw
        if ($SslPort -eq -1) {
            $ssl = [regex]::Replace($ssl, '(?m)^(\s*)Listen\s+443\s*$', '$1#Listen 443   # AzubiBoard: Port war belegt')
            $hinweisSsl = "HTTPS-Lauscher abgeschaltet (Port 443 belegt)"
        } else {
            $ssl = [regex]::Replace($ssl, '(?m)^(\s*)Listen\s+443\s*$', "`$1Listen $SslPort")
            $hinweisSsl = "HTTPS-Lauscher auf Port $SslPort umgelegt"
        }
        if ($DryRun) { Dry "$hinweisSsl -> $sslConf" }
        else { Set-Utf8NoBom $sslConf $ssl; Ok $hinweisSsl }
    }

    # AllowOverride NICHT mehr global ersetzen: das traf auch den <Directory />-
    # Wurzelblock, der aus Sicherheitsgruenden 'none' haben muss, und auf einem
    # Server mit weiteren Anwendungen deren Verzeichnisbloecke gleich mit.
    # Stattdessen ein eigener, markierter Block nur fuer unseren Ordner -
    # idempotent, weil er beim Re-Run erst herausgeschnitten und neu angehaengt wird.
    $mark  = '# --- AzubiBoard (vom Installer verwaltet) ---'
    $markE = '# --- Ende AzubiBoard ---'
    $appDirConf = $appPath -replace '\\', '/'
    $block = @"
$mark
<Directory "$appDirConf">
    AllowOverride All
    Require all granted
    Options -Indexes +FollowSymLinks
</Directory>
# vendor/ und database/ enthalten PHP-Bibliotheken und das DB-Schema und
# gehoeren nie ausgeliefert (bekannter Angriffsweg ueber vendor/.../phpunit).
<Directory "$appDirConf/vendor">
    Require all denied
</Directory>
<Directory "$appDirConf/database">
    Require all denied
</Directory>
$markE
"@
    $confOhne = [regex]::Replace($conf, "(?s)\r?\n?" + [regex]::Escape($mark) + ".*?" + [regex]::Escape($markE) + "\r?\n?", "`n")
    $confNeu  = $confOhne.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
    if ($confNeu -ne $conf) { $conf = $confNeu; $changed = $true }
    Ok "Eigener <Directory>-Block fuer $appPath (fremde Bloecke unveraendert)"

    if ($changed -and $DryRun) { Dry "httpd.conf speichern (Aenderungen oben) -> $apacheConf" }
    elseif ($changed) {
        Set-Utf8NoBom $apacheConf $conf
        # Syntaxpruefung, BEVOR der Dienst neu startet - sonst laeuft der
        # Webserver nach einem Tippfehler gar nicht mehr (auch fremde Seiten!)
        if (Test-Path $apacheExe) {
            $syntax = Invoke-Native { & $apacheExe -t 2>&1 | Out-String }
            if ($syntax -notmatch 'Syntax OK') {
                Copy-Item "$apacheConf.azubiboard.bak" $apacheConf -Force
                Die "Apache-Konfiguration waere fehlerhaft gewesen - Original wiederhergestellt. Meldung: $($syntax.Trim())"
            }
        }
        Ok "httpd.conf gespeichert (Syntax geprueft, Sicherung: httpd.conf.azubiboard.bak)"
    }
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

$fwName = "AzubiBoard HTTP ($WebPort)"
if ($DryRun) {
    Dry "Apache-Dienst '$APACHE_SVC' registrieren/starten"
    Dry "Firewall-Regel '$fwName' (TCP $WebPort eingehend) anlegen"
} else {
# Apache-Dienst (erneut versuchen, falls vorher nicht registriert) + starten
if (-not (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue)) {
    & $apacheExe -k install -n $APACHE_SVC | Out-Null
    Start-Sleep -Seconds 2
    if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) { Set-Service -Name $APACHE_SVC -StartupType Automatic }
}
if (Get-Service -Name $APACHE_SVC -ErrorAction SilentlyContinue) {
    Restart-Service $APACHE_SVC -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    if ((Get-Service $APACHE_SVC).Status -ne 'Running') { Start-Service $APACHE_SVC -ErrorAction SilentlyContinue }
    if ((Get-Service $APACHE_SVC).Status -eq 'Running') {
        Ok "Apache-Dienst '$APACHE_SVC' laeuft (Port $WebPort)"
    } else {
        # Haeufigste Ursache auf einem belegten Server: der Port ist doch besetzt
        $wer = Get-PortBesitzer $WebPort
        if ($wer) { Info "Apache startet nicht - Port $WebPort ist von '$($wer.Name)' belegt. Erneut mit -WebPort <freier port> starten." }
        else      { Info "Apache-Dienst startet nicht. Ursache steht in $xamppPath\apache\logs\error.log" }
    }
} else {
    Info "Apache nicht als Dienst - via XAMPP Control Panel starten"
}

# Firewall: nur ergaenzen, nie bestehende Regeln aendern
if (-not (Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Protocol TCP -LocalPort $WebPort -Action Allow -Profile Any | Out-Null
    Ok "Firewall-Regel fuer Port $WebPort angelegt"
} else {
    Ok "Firewall-Regel fuer Port $WebPort vorhanden"
}
}  # Ende DryRun-Guard Abschnitt 9

# ── 10. Taegliche DB-Sicherung (Scheduled Task) ──────────────
Hdr "10/11 Taegliche DB-Sicherung"
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
        foreach ($sid in $SID_SYSTEM, $SID_ADMINS) {
            $acl.AddAccessRule((New-AclRule $sid 'FullControl'))
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
    # Host+Port IMMER mitgeben: weicht die lokale MariaDB einem fremden Dienst
    # auf einen anderen Port aus, liefe der Dump sonst gegen die fremde Instanz
    # (oder ins Leere) - und das faellt erst auf, wenn man das Backup braucht.
    $dumpAuth = "'-h','$dbConnHost','-P','$DbPort','-u','azubiboard_user','-p$DbPass'"
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

# ── 11. Selbsttest: antwortet die Anwendung wirklich? ────────
# Bisher meldete das Skript "Installation abgeschlossen", ohne je geprueft zu
# haben, ob etwas laeuft - auf einem Server mit vorhandener Software ist genau
# das der wahrscheinliche Fall (Port belegt, fremder Dienst, .htaccess ohne
# Wirkung). Der Selbsttest geht denselben Weg wie ein Browser.
Hdr "11/11 Selbsttest"
if ($DryRun) {
    Dry "Frontend, API, .env-Sperre und DB-Zugang der App ueber HTTP pruefen"
} else {
    if (-not (Invoke-Selbsttest)) {
        Write-Host ""
        Write-Host "  Die Installation ist damit NICHT fertig." -ForegroundColor Red
        Stop-Log
        Wait-Taste
        exit 1
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
Write-Host "  App-URL:     $appUrlBasis/azubiboard/" -ForegroundColor Cyan
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
Write-Host "   1. $appUrlBasis/azubiboard/ oeffnen + Account registrieren"
Write-Host "   2. Ausbilder-Rolle setzen:"
# Passwort bewusst NICHT ausgeben (-p fragt interaktiv nach)
$hintAuth = if ($dbRemote) { "-h $DbHost -P $DbPort -u $DbAdminUser -p" } else { "-u $DbAdminUser" }
Write-Host "      & '$mysqlCli' $hintAuth azubiboard -e `"UPDATE users SET role='ausbilder' WHERE email='DEINE@EMAIL.DE';`"" -ForegroundColor White
Stop-Log
Wait-Taste
exit 0
