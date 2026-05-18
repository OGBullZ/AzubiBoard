# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projekt

**AzubiBoard** — Ausbildungs-Management-Tool. React 19 + Vite 7 + PHP 8.2 + MariaDB. PWA mit 2FA, Multi-User-Sync, Conflict-Detection und Audit-Log.

Repository: https://github.com/OGBullZ/AzubiBoard  
Deployment-Server: Ubuntu LAMP, IP `10.14.99.10`, App unter `/azubiboard/`

## Aktueller Stand

**Letzter Commit:** `b815659` (18. Mai 2026) — HANDOVER.md update  
**Abgeschlossen:** Sprint 11 + Fehleranalyse/Bugfixes (Hover-Actions-Fix, API-Routing-Fix, install_ubuntu.sh)  
**Schema-Version:** v5 (`data.learningPaths`, `data.pathProgress`)

Vollständige Sprint-Historie → `HANDOVER.md`  
Cloud-Deploy-Anleitung → `DEPLOY.md`

## Build / Test

```bash
npm install
npm run dev       # Vite Dev-Server → http://localhost:5173/azubiboard/
npm test          # Vitest (44 Tests)
npm run e2e       # Playwright (6 Tests, braucht Chromium)
npm run build     # Produktions-Bundle → dist/
```

## Wichtige Coding-Patterns

**Pflicht beim State-Update:**
```js
setData({ ...data, foo: newValue })  // ✅ IMMER spreaden
setData({ foo: newValue })           // ❌ löscht projects/users/etc.
```

**Neue Routes immer lazy:**
```js
const NewPage = lazy(() => import('./features/xyz/NewPage.jsx'))
// + Suspense-Fallback in App.jsx
```

**PHP-Routes:** Reihenfolge spezifisch → allgemein. Spezifischere Patterns (z.B. `/api/data/backups/{day}`) müssen VOR dem allgemeinen (`/api/data/backups`) stehen — `respond()` beendet die Ausführung sofort.

**Store-Pattern:** `src/lib/store.js` — pub/sub mit BroadcastChannel für Multi-Tab-Sync. Keine direkte Manipulation, immer über `setData`.

## Wiederkehrende Probleme (Gotchas)

**OneDrive-Clash-Files** — Vor jedem Push prüfen:
```bash
find . -name "*Name clash*" -not -path "./node_modules/*" -not -path "./dist/*"
```
Wenn vorhanden: prüfen ob byte-identisch zu HEAD, dann löschen.

**PHP-Auth-Header** — Apache mod_php vs CGI unterschiedlich: `api/config.php` hat Fallback via `getallheaders()` + `REDIRECT_HTTP_AUTHORIZATION`. Nicht vereinfachen.

**dist/ ist gitignored** — `install_ubuntu.sh` baut auf dem Server selbst (`npm run build`). Nie dist/ committen.

**MySQL Socket-Auth (Ubuntu)** — Root hat kein Passwort bei frischer Installation. `mysql` (ohne `-u root`) als OS-root reicht.

**CSP + Tesseract.js** — `.htaccess` CSP muss `https://cdn.jsdelivr.net` und `https://tessdata.projectnaptha.com` in `connect-src` enthalten. Worker braucht `blob:` in `worker-src`.

## Dateien die NICHT ohne explizite Aufforderung geändert werden

- `api/config.php` — Auth/JWT/TOTP-Core, Änderungen haben Sicherheits-Impact
- `database/azubiboard.sql` — Ziel-Schema für Sprint 12, kein Spielfeld
- `.env.server` — Produktions-Credentials, nie committen
- `src/lib/migrations.js` — Schema-Migrationen sind irreversibel; nur bei explizitem Sprint

## Wichtige Pfade

- `src/App.jsx` — Root, Routing, Bootstrap
- `src/lib/dataService.js` — API/Save-Queue/Conflict-Detection
- `src/lib/utils.js` — ISO-KW, Datums-Helfer, Farb-Konstanten (C, ST)
- `src/lib/migrations.js` — Schema-Migrations v1–v5
- `src/lib/roles.js` — `isStaff()`, `isAusbilder()`, `isMentor()`
- `api/config.php` — JWT, TOTP, Rate-Limit, CORS-Helfer
- `api/routes/data.php` — JSON-Blob CRUD + Backups
- `public/.htaccess` → wird nach `dist/.htaccess` kopiert (SPA-Routing + CSP)
- `install_ubuntu.sh` — Ubuntu LAMP Deployment-Skript

## Datenbank

- Aktiv genutzte Tabellen: `users`, `app_data`, `app_data_history`, `partial_tokens`, `jwt_blocklist`, `share_links`, `audit_log`
- `database/setup.sql` — Minimal-Setup für neue Server
- `database/azubiboard.sql` — vollständiges Ziel-Schema (Sprint 12 / L5)

## Was als Nächstes sinnvoll ist

| Sprint | Item | Aufwand |
|---|---|---|
| **12** ⚠️ | **L5** — MySQL-Schema-Refactor (JSON-Blob → relationale Tabellen) | 3–5 Tage |
| **12** | Row-Level Security, Volltextsuche | mit L5 |
| **später** | **M4** Multi-Tenant, **M5** IHK-API | groß |

## Autonomie-Hinweis

User hat volle Autonomie für AzubiBoard gewährt: Commits, Pushes, Datei-Edits ohne Bestätigungs-Prompts. Nur bei genuinen destruktiven Aktionen (Daten löschen, Force-Push auf main) kurz kommunizieren.
