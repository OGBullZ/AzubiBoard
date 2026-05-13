# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev-Server auf http://localhost:5173 (proxied → XAMPP PHP)
npm run build        # Produktions-Build nach dist/
npm test             # Vitest unit tests (einmalig)
npm run test:watch   # Vitest im Watch-Modus
npm run lint         # ESLint
npm run e2e          # Playwright E2E-Tests
deploy.bat           # Build nach C:\xampp\htdocs\azubiboard\ deployen
```

Einzelne Test-Datei ausführen:
```bash
npx vitest run src/lib/migrations.test.js
```

Nach Code-Änderungen ins XAMPP deployen: `npm run build` dann `deploy.bat`.

## Architektur

### Dual-Mode (localStorage vs. PHP-API)
Die App hat zwei Betriebsmodi, gesteuert durch `.env`:
- **`VITE_USE_API=false`** – reine Frontend-App, alle Daten in `localStorage`
- **`VITE_USE_API=true`** – PHP/MySQL-Backend über XAMPP (Produktionsmodus)

Der Schalter `const USE_API = import.meta.env.VITE_USE_API === 'true'` in `src/App.jsx` und `src/lib/dataService.js` kontrolliert alle API-abhängigen Pfade. Passwortänderung, Avatar-Upload und 2FA sind nur im API-Modus verfügbar.

### Daten-Schicht (`src/lib/`)
- **`dataService.js`** – einziger Datenzugriffspunkt. Gibt Daten aus `localStorage` oder von der PHP-API zurück. Enthält eine `saveQueue` mit Exponential-Backoff und ETag-basierter Konfliktbehandlung.
- **`store.js`** – custom pub/sub Store (kein Zustand). Globaler State: `{ data, currentUser }`. `setData` schreibt sofort in `localStorage` und feuert den API-Save asynchron. BroadcastChannel synchronisiert `data` zwischen Tabs.
- **`migrations.js`** – `migrateData(data)` läuft beim App-Start. Jede Schemaveränderung braucht eine neue Migration in `MIGRATIONS` und `CURRENT_SCHEMA_VERSION` hochzählen.

### Data-Blob
Alle App-Daten leben in einem einzigen JSON-Objekt: `{ users, projects, reports, calendarEvents, groups, activityLog, trash, schema_version, … }`. Im API-Modus wird dieses Blob als ganzes in MySQL gespeichert (ein Row pro Version); die Nutzerliste wird separat aus der `users`-Tabelle synchronisiert.

### Frontend-Struktur
- `src/App.jsx` – Router, Auth-Gate, globale Hooks (Toast, Theme, Keyboard-Shortcuts, Notifications), AppLayout mit Sidebar
- `src/features/` – feature-basierte Komponenten, schwergewichtige Routes werden per `React.lazy()` geladen
- `src/components/` – geteilte UI-Bausteine (`UI.jsx`, `Icons.jsx`, `ErrorBoundary.jsx`, …)

### PHP-Backend (`api/`)
- `api/config.php` – DB-Verbindung (PDO), JWT (HS256 custom), CORS, Rate-Limiting (dateibasiert), TOTP-2FA, Input-Validierung
- `api/index.php` – Router: leitet auf `api/routes/{auth,data,users,share,audit}.php` weiter
- `api/routes/data.php` – GET/POST für den Daten-Blob mit ETag/If-Match Optimistic-Locking
- Auth: Bearer-JWT. `require_auth()` / `require_role('ausbilder')` am Anfang jeder Route

### Rollen
Zwei Rollen: **`ausbilder`** (Trainer – sieht alle Nutzer, Berichte, Server-Backups) und **`azubi`** (Auszubildender – sieht nur eigene Daten). Rolle steckt im JWT-Payload und im User-Objekt.

### Deploy-Workflow (XAMPP)
1. `npm run build` → erzeugt `dist/`
2. `deploy.bat` → kopiert `dist/`, `api/`, `.htaccess`, `database/` nach `C:\xampp\htdocs\azubiboard\`
3. `.env` liegt in `C:\xampp\htdocs\azubiboard\.env` (nicht im Repo)
4. Datenbank: Schema aus `database/setup.sql`, Demo-Daten via `C:\xampp\php\php.exe <htdocs>\database\seed.php`
