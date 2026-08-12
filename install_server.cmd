@echo off
setlocal
title AzubiBoard - Server-Installer
cd /d "%~dp0"

rem ============================================================
rem  AzubiBoard - Start des Server-Installers per DOPPELKLICK
rem ============================================================
rem  Warum diese Datei existiert:
rem   - "Mit PowerShell ausfuehren" fehlt im Kontextmenue, wenn .ps1 auf dem
rem     Server nicht registriert ist (auf aktuellen Windows-Versionen der Fall)
rem   - Windows-Server stehen standardmaessig auf ExecutionPolicy=RemoteSigned,
rem     das blockiert .ps1-Dateien vom Stick / aus einem entpackten ZIP
rem   - .cmd unterliegt keiner ExecutionPolicy -> laeuft immer
rem
rem  Optionen einfach anhaengen, z.B.:
rem     install_server.cmd -Interactive
rem     install_server.cmd -DbHost 10.14.99.12 -DbRootPass geheim
rem     install_server.cmd -DryRun
rem ============================================================

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"

rem Mark-of-the-Web entfernen (Dateien aus einem heruntergeladenen ZIP sind
rem sonst "aus dem Internet" und werden trotz Bypass beanstandet)
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%~dp0.' -Filter *.ps1 -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

if not exist "%~dp0install_server.ps1" (
  echo.
  echo   FEHLER: install_server.ps1 liegt nicht neben dieser Datei.
  echo   Bitte den kompletten Projektordner auf den Stick kopieren.
  echo.
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_server.ps1" %*
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo   Installer mit Fehlercode %RC% beendet - Meldungen oben pruefen.
  echo.
  pause
)
endlocal & exit /b %RC%
