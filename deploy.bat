@echo off
:: ============================================================
::  AzubiBoard – Deploy nach XAMPP
::  Ausführen: Doppelklick oder "deploy.bat" im Projektordner
:: ============================================================
setlocal

set TARGET=C:\xampp\htdocs\azubiboard
set SOURCE=%~dp0

echo.
echo  AzubiBoard Deploy → %TARGET%
echo  ============================================
echo.

:: ── 1. Zielordner anlegen wenn nötig ────────────────────────
if not exist "%TARGET%" (
    mkdir "%TARGET%"
    echo  [+] Ordner %TARGET% erstellt
)

:: ── 2. Frontend (dist/) kopieren ────────────────────────────
echo  Kopiere Frontend...
xcopy /E /Y /I /Q "%SOURCE%dist\*" "%TARGET%\"
echo  [OK] dist/

:: ── 3. PHP-Backend (api/) kopieren ──────────────────────────
echo  Kopiere API...
if not exist "%TARGET%\api" mkdir "%TARGET%\api"
if not exist "%TARGET%\api\routes" mkdir "%TARGET%\api\routes"
xcopy /E /Y /I /Q "%SOURCE%api\*" "%TARGET%\api\"
echo  [OK] api/

:: ── 4. .htaccess kopieren ───────────────────────────────────
copy /Y "%SOURCE%.htaccess" "%TARGET%\.htaccess" >nul
echo  [OK] .htaccess

:: ── 5. uploads-Ordner anlegen ───────────────────────────────
if not exist "%TARGET%\uploads" mkdir "%TARGET%\uploads"
echo  [OK] uploads/

:: ── 5b. Seed-Script kopieren (einmalig für Demo-Daten) ──────
if not exist "%TARGET%\database" mkdir "%TARGET%\database"
xcopy /E /Y /I /Q "%SOURCE%database\*" "%TARGET%\database\"
echo  [OK] database/ (seed.php + .htaccess)

:: ── 6. .env prüfen ──────────────────────────────────────────
if not exist "%TARGET%\.env" (
    copy /Y "%SOURCE%.env.example" "%TARGET%\.env" >nul
    echo.
    echo  [!] .env wurde aus .env.example kopiert.
    echo      Bitte jetzt bearbeiten:
    echo      %TARGET%\.env
    echo.
    echo      Folgende Werte eintragen:
    echo        DB_USER, DB_PASS, JWT_SECRET
    echo.
    start notepad "%TARGET%\.env"
) else (
    echo  [OK] .env vorhanden
)

echo.
echo  ============================================
echo  Fertig! App erreichbar unter:
echo  http://localhost/azubiboard/
echo.
echo  Naechste Schritte:
echo    1. .env bearbeiten (DB_USER, DB_PASS, JWT_SECRET)
echo    2. MySQL-Tabellen anlegen:
echo       mysql -u root -p ^< database\setup.sql
echo    3. Demo-Nutzer anlegen (einmalig, via CLI):
echo       C:\xampp\php\php.exe %TARGET%\database\seed.php
echo       (Webzugriff ist durch .htaccess gesperrt)
echo  ============================================
echo.
pause
