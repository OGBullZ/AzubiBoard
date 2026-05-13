@echo off
:: ============================================================
::  AzubiBoard – Rebuild & Deploy nach XAMPP
::  Doppelklick oder "rebuild.bat" im Projektordner
:: ============================================================
setlocal

set PROJECT=C:\Users\Master\Desktop\Code\AzubiBoard
set TARGET=C:\xampp\htdocs\azubiboard

echo.
echo  AzubiBoard Rebuild ^& Deploy
echo  ============================
echo.

:: ── 1. Frontend bauen ────────────────────────────────────────
echo  [1/3] Baue Frontend (npm run build)...
cd /d "%PROJECT%"
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [FEHLER] Build fehlgeschlagen!
    exit /b 1
)
echo  [OK] Build fertig

:: ── 2. Frontend-Dateien nach htdocs kopieren ─────────────────
echo  [2/3] Kopiere Frontend nach %TARGET%...
xcopy /E /Y /I /Q "%PROJECT%\dist\*" "%TARGET%\" >nul
echo  [OK] Frontend deployed

:: ── 3. API + .env kopieren ───────────────────────────────────
echo  [3/3] Kopiere API + .env...
xcopy /E /Y /I /Q "%PROJECT%\api\*" "%TARGET%\api\" >nul
copy /Y "%PROJECT%\.env"      "%TARGET%\.env"      >nul
copy /Y "%PROJECT%\.htaccess" "%TARGET%\.htaccess" >nul
echo  [OK] API + .env deployed

echo.
echo  ============================
echo  Fertig! App unter:
echo  http://localhost/azubiboard/
echo  ============================
echo.
