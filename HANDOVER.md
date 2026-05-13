# AzubiBoard – Projekt-Übergabe

Letzter Stand: **Sprint 8** (Commit `8b07bbd`), Mai 2026.

---

## Was ist AzubiBoard?

Eine Ausbildungs-Management-App für Azubis und Ausbilder. Rollen: **ausbilder** (Trainer) und **azubi** (Auszubildender). Features: Projekte/Kanban, Aufgaben, Wochenberichte, Kalender, Ausbildungsplan, Lernbereich, Gruppen, Netzplan/Gantt, PDF-Export, Papierkorb, 2FA, PWA, Offline-Sync.

**Lokal erreichbar:** `http://localhost/azubiboard/`  
**Dev-Server:** `http://localhost:5173/azubiboard/`  
**GitHub:** `https://github.com/OGBullZ/AzubiBoard`

---

## Setup auf neuem Laptop

### Voraussetzungen
- Node.js 20+, npm
- XAMPP (Apache + MySQL/MariaDB)
- Git

### Schritte
```bash
# 1. Repo klonen
git clone https://github.com/OGBullZ/AzubiBoard.git
cd AzubiBoard
npm install

# 2. Env-Datei anlegen
cp .env.example .env
# .env öffnen und ausfüllen:
#   JWT_SECRET = beliebige 32+ Zeichen (openssl rand -hex 32)
#   DB_USER = root  (XAMPP-Standard)
#   DB_PASS =       (XAMPP leer)

# 3. XAMPP starten (Apache + MySQL)
# Im XAMPP Control Panel beide Dienste auf "Running"

# 4. Datenbank anlegen
# phpMyAdmin → "azubiboard" erstellen, Collation: utf8mb4_unicode_ci
# Dann: database/setup.sql importieren (phpMyAdmin → Importieren)

# 5. Demo-Daten (einmalig)
C:\xampp\php\php.exe C:\xampp\htdocs\azubiboard\database\seed.php

# 6. Frontend bauen & deployen
npm run build
deploy.bat

# 7. Fertig → http://localhost/azubiboard/
```

**Demo-Accounts** (Passwort für alle: `1234`):
| E-Mail | Rolle |
|---|---|
| ausbilder@firma.de | Ausbilder |
| anna@azubi.de | Azubi |
| tom@azubi.de | Azubi |

### Nur Dev (ohne XAMPP, localStorage-Modus)
```bash
# .env: VITE_USE_API=false
npm run dev
# → http://localhost:5173/azubiboard/
# Daten nur im Browser-localStorage, kein Backend nötig
```

---

## Architektur

### Dual-Mode (Kernkonzept)
`VITE_USE_API=false` → reine Frontend-App, Daten in `localStorage`  
`VITE_USE_API=true`  → PHP/MySQL-Backend (XAMPP), JWT-Auth

Jede API-abhängige Stelle prüft: `const USE_API = import.meta.env.VITE_USE_API === 'true'`

### Frontend
- **React 19 + Vite 7**, React Router v7, PWA (vite-plugin-pwa)
- **State:** Custom pub/sub Store in `src/lib/store.js` — kein Zustand/Redux. `{ data, currentUser }`. BroadcastChannel synchronisiert `data` zwischen Browser-Tabs.
- **Datenzugriff:** `src/lib/dataService.js` — einzige Schnittstelle. `saveQueue` mit Exponential-Backoff und ETag-basierter Konfliktbehandlung.
- **Data-Blob:** Alle App-Daten in einem JSON-Objekt `{ users, projects, reports, calendarEvents, groups, activityLog, trash, trainingPlan, schema_version }`. Im API-Modus als ein Row in MySQL, lokal in `localStorage`.
- **Schema-Migrations:** `src/lib/migrations.js` — `migrateData()` läuft beim Start. Aktuelle Version: 3.
- **Code-Splitting:** Schwergewichtige Routes sind `React.lazy()` — Dashboard und ProjectPool laden eager, alles andere on-demand.

### Backend (`api/`)
- `api/config.php` — DB-Verbindung (PDO/MySQL), JWT (HS256), CORS, file-basiertes Rate-Limiting, TOTP-2FA, Input-Validierung
- `api/index.php` — Router zu `api/routes/{auth,data,users,share,audit}.php`
- `api/routes/data.php` — GET/POST für den Blob mit ETag/If-Match Optimistic-Locking, Snapshot-History (30 Tage)
- `api/routes/auth.php` — Login, Register, 2FA (TOTP), Passwort ändern, Avatar-Upload

### MySQL-Tabellen (aktiv genutzt)
| Tabelle | Zweck |
|---|---|
| `users` | Auth, Rollen, Theme, Avatar, 2FA-Felder |
| `app_data` | JSON-Blob mit allen App-Daten (1 Row) |
| `app_data_history` | Tägliche Snapshots (30 Tage), für Server-Backup-Feature |
| `audit_log` | Append-only Aktions-Log, 365 Tage Retention |

Tabellen werden per `CREATE TABLE IF NOT EXISTS` auto-angelegt — kein separates Migrations-Script nötig.

---

## Sprint-Historie

| Sprint | Commit | Was |
|---|---|---|
| Sprint 1 | `fd16443` | Kritische Datenverlust-Bugs, ISO-KW, Mobile-DnD, Toast-Undo |
| Sprint 2 | `e26a0e4` | Retry-Queue (Save-Queue), Audit-Log, Vitest-Smoke |
| Sprint 3 | `c4d7ea3` | Backend-Hardening, Backup-Reminder, i18n-Scaffold |
| Sprint 4 | `9d9e850` | Smart-Polling-Sync (ersetzt SSE) |
| Sprint 5 | `f152826` | Conflict-Detection (ETag/If-Match), Papierkorb, E2E-Smoke |
| Sprint 6 | `d51fd3f` | Bulk-Import, IHK-PDF, Share-Links, Code-Splitting, CI, Browser-Push |
| Sprint 7 | `115035c` | Sentry, Server-Backups (Snapshots), Schema-Migrations, Background-Sync (PWA) |
| Sprint 8 | `8b07bbd` | 2FA (TOTP), Audit-Route, CSP-Headers |

---

## Roadmap V — Nächste Schritte

### Sprint 9 — L5: MySQL-Refactor (Datenschicht)
Aktuell lebt der App-State als ein JSON-Blob in `app_data`. Ziel: Kritische Entitäten in echte relationale Tabellen auslagern.
- `projects`, `tasks`, `reports`, `calendar_events` als eigene Tabellen
- Migration des bestehenden Blobs per Script
- API-Routen entsprechend umstellen
- **Vorsicht:** Betrifft `dataService.js` grundlegend — save/load-Logik muss komplett neu

### Sprint 10 — Adoption & Kommunikation
- **M3:** Wöchentliche E-Mail-Zusammenfassung für Ausbilder (SMTP via PHP, cron)
- **M2:** Mentor-Funktion — Azubi kann Ausbilder als Mentor zuweisen, Ausbilder sieht gefiltertes Dashboard
- **K2:** Granulare Berechtigungen (z. B. Azubi darf eigene Projekte nicht löschen)

### Sprint 11 — Lernbereich & Quiz
- **C1:** Ausbilder kann eigene Quiz-Fragen erstellen (aktuell statisch in `src/data/quiz.json`)
- **C3:** Lernfortschritt pro Themenbereich tracken
- **M1:** OCR-Import für handschriftliche Berichte (Tesseract.js im Browser)

### Sprint 12+ — Multi-Tenant
- **M4:** Mehrere Ausbildungsbetriebe auf einer Instanz
- Tenant-Isolation auf Datenbankebene

---

## Wichtige Gotchas

1. **OneDrive-Konflikt:** Repo NICHT in OneDrive legen. `node_modules` + Git-Objekte führen zu Sync-Konflikten. Immer `C:\Users\Master\Desktop\Code\AzubiBoard` (außerhalb OneDrive).

2. **VITE_USE_API-Falle:** Im Dev-Modus mit `VITE_USE_API=true` müssen Apache + MySQL laufen. Login schlägt mit "Datenbankfehler" fehl wenn MySQL gestoppt ist — im XAMPP Control Panel prüfen.

3. **Deploy ≠ npm run dev:** Die `.env` im Projektordner steuert den Dev-Build. Die `.env` unter `C:\xampp\htdocs\azubiboard\.env` steuert das XAMPP-Deployment. Beide separat pflegen.

4. **ISO-Kalenderwochen:** `date-fns` wird nicht verwendet — ISO-KW-Berechnung ist custom in `src/lib/utils.js`. Bitte nicht durch `new Date().getWeek()` ersetzen (falsch an Jahresgrenzen).

5. **2FA-Migrations-Spalten:** Die TOTP-Spalten in `users` werden beim ersten `/api/auth/*`-Aufruf per `ALTER TABLE IF NOT EXISTS` auto-angelegt. Auf MySQL < 8.0 schlägt `IF NOT EXISTS` in ALTER fehl — manuell anlegen nötig (XAMPP hat 8.0+, unkritisch).

6. **ETag-Konflikt-Dialog:** Wenn zwei Browser-Tabs gleichzeitig speichern, erscheint ein "Server vs. eigene Version"-Dialog. Das ist Feature, kein Bug (Sprint 5, `ConflictDialog.jsx`).

7. **PWA im Dev-Modus:** `devOptions.enabled: false` in `vite.config.js` — Service Worker läuft im Dev-Server NICHT. Nur im gebauten XAMPP-Deploy aktiv.

8. **CSP-Header:** `api/config.php` setzt `X-Frame-Options: DENY` und andere Security-Header. Falls iFrame-Einbettung gewünscht, dort anpassen.

9. **Share-Links:** Öffentliche `/share/:token`-Route bypasses Auth komplett. Token-Generierung in `api/routes/share.php`, 32-stelliger Hex-Token.

10. **Altes Repo:** `C:\Users\Master\Desktop\Code\AzubiBoard-main` zeigt auf ein anderes Remote (`Projekt1.git`). Immer nur `AzubiBoard/` verwenden.

---

## Test-Status (Stand Sprint 8)

```bash
npm test        # Vitest — unit tests
npm run e2e     # Playwright — E2E (braucht laufenden Server: npm run dev)
npm run lint    # ESLint
```

CI läuft auf GitHub Actions (`.github/workflows/ci.yml`): Unit + Build → E2E-Smoke → Lighthouse.

---

## Env-Variablen Übersicht

| Variable | Wo | Bedeutung |
|---|---|---|
| `VITE_USE_API` | `.env` | `true` = PHP/MySQL, `false` = localStorage |
| `VITE_BASE_PATH` | `.env` | Unterpfad (`/azubiboard/` für XAMPP, `/` für eigene Domain) |
| `VITE_PHP_DEV_URL` | `.env` | Proxy-Ziel für Dev-Server (default: `http://localhost`) |
| `VITE_SENTRY_DSN` | `.env` | Sentry Error-Tracking (leer = deaktiviert) |
| `JWT_SECRET` | `.env` (Backend) | Min. 32 Zeichen, nie committen |
| `JWT_EXPIRY` | `.env` (Backend) | Token-Laufzeit in Sekunden (default: 604800 = 7 Tage) |
| `DB_USER/DB_PASS` | `.env` (Backend) | MariaDB-Zugangsdaten |
| `ALLOWED_ORIGIN` | `.env` (Backend) | CORS-Origin (`http://localhost` für XAMPP-Dev) |
| `APP_ENV` | `.env` (Backend) | `development` = Fehlerdetails in API-Responses |
