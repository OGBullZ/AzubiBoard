# 📋 AzubiBoard — Projekt-Handover

> **Stand:** 18. Mai 2026 · **Letzter Commit:** `74e017e` (Backup-Cron + UI-Improvements + CLAUDE.md Arbeitsregeln)
> Dieses Dokument fasst den kompletten Projektstand zusammen, damit eine neue Claude-Code-Session
> (auf einem anderen Laptop) ohne Reibung weiterarbeiten kann.

---

## 🚀 Schnellstart auf neuem Laptop

```bash
# 1. Repo klonen
git clone https://github.com/OGBullZ/AzubiBoard.git
cd AzubiBoard

# 2. Dependencies installieren (~2 min, ca. 600 MB node_modules)
npm install

# 3. Datenbank einrichten (mit XAMPP/MariaDB lokal)
#    Option A — komplettes Schema importieren (empfohlen):
mysql -u root -p azubiboard < database/azubiboard.sql

#    Option B — Minimal-Setup für lokalen Modus (ohne DB):
#    Einfach `.env` anlegen mit VITE_USE_API=false — alles via localStorage

# 4. .env aus Beispiel kopieren und anpassen
cp .env.example .env
# → DB_PASS, JWT_SECRET, ALLOWED_ORIGIN einstellen
# → VITE_USE_API=true für API-Modus, false für lokal-only

# 5. Dev-Server starten
npm run dev        # http://localhost:5173/azubiboard/

# 6. Verifizieren
npm test           # 44 Unit-Tests — alle grün
npm run e2e        # 6 Playwright-Tests (braucht Chromium)
npm run build      # produktions-Bundle
```

**Demo-Login** (im lokalen Modus): `ausbilder@firma.de` / `12345678` oder `anna@azubi.de` / `12345678`
*(Hinweis: Demo-Daten verwenden noch das alte Passwort `1234`. In Sprint 8 wurde die Mindestlänge auf 8 Zeichen erhöht — neue User müssen 8+ verwenden.)*

---

## 📦 Stack auf einen Blick

| Schicht | Technologie |
|---|---|
| **Frontend** | React 19, Vite 7, react-router-dom 7, zustand 5 (light state), react-i18next |
| **Build/Test** | Vitest 4, Playwright 1, vite-plugin-pwa (Workbox), eslint 9 |
| **Drag&Drop** | `@dnd-kit/core` + sortable + utilities |
| **Misc** | qrcode (lazy), @sentry/react (opt-in via DSN), tesseract.js + pdfjs-dist (lazy, OCR) |
| **Backend** | PHP 8.2, MariaDB 10.4 (XAMPP local), PDO, eigenes JWT (HS256), bcrypt |
| **PWA** | Service Worker mit Workbox BackgroundSync für POST /api/data |
| **CI** | GitHub Actions: Unit + E2E + Lighthouse |
| **Hosting** | Apache (`.htaccess` SPA-Routing) + PHP-FPM, App unter `/azubiboard/` |

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Vite + React 19)                              │
│                                                          │
│  src/App.jsx        — Wurzel + Routing + Modals          │
│  src/features/      — Domain-Module                       │
│    dashboard/       — Azubi- vs. Ausbilder-Dashboard     │
│    projects/        — Pool, Detail, Tabs, Netzplan       │
│    reports/         — Berichtshefte + PDF-Export         │
│    training/        — Ausbildungsplan + Import           │
│    learn/           — Quiz/Lernportal + Karteikarten + Lernpfade │
│    calendar/        — Kalender + iCal-Export             │
│    groups/          — Teams/Lerngruppen                  │
│    users/           — User-Mgmt + Azubi-Profil           │
│    trash/           — Papierkorb (Soft-Delete)           │
│    share/           — Public-Read-Share-Links            │
│    auth/            — Login + 2FA-Settings               │
│  src/lib/           — Pure-Logik (testbar)               │
│    dataService.js   — API/localStorage-Adapter +         │
│                       Save-Queue mit Backoff +           │
│                       Conflict-Detection (If-Match)      │
│    utils.js         — ISO-KW, Datums-Helfer, addActivity │
│    trash.js         — Soft-Delete + Restore              │
│    migrations.js    — Schema-Migrations v1–v5 (data.schema_version)│
    roles.js         — isStaff/isAusbilder/isMentor Helper   │
    hooks.js         — useDebounce React-Hook                │
│    backup.js        — Backup-Reminder                    │
│    i18n.js          — react-i18next-Init (de/en)         │
│    sentry.js        — Error-Tracking (opt-in)            │
│    webPush.js       — Browser-Notifications              │
│    useDataSync.js   — Smart-Polling für Multi-User       │
│  src/components/    — Reusable UI                        │
│    UI.jsx, ConfirmDialog, ConflictDialog,                │
│    BackupsModal, ShareLinkModal, SyncIndicator,          │
│    BackupReminder, ErrorBoundary                         │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP/JSON (Bearer JWT)
┌──────────────────────────▼───────────────────────────────┐
│  Backend (api/, PHP 8.2)                                  │
│                                                          │
│  api/index.php      — Router (resource-based)             │
│  api/config.php     — DB-Pool + JWT + TOTP +              │
│                       Rate-Limit (file-based)             │
│  api/routes/                                              │
│    auth.php         — Login/Register/Profile/2FA          │
│    data.php         — JSON-Blob CRUD + Versions/Backups   │
│    users.php        — User-Verwaltung (Ausbilder)         │
│    share.php        — Public Read-Share-Tokens            │
│    audit.php        — Server-Side Audit-Log               │
└──────────────────────────┬───────────────────────────────┘
                           │ PDO Prepared Statements
┌──────────────────────────▼───────────────────────────────┐
│  MariaDB (azubiboard)                                     │
│                                                          │
│  ─── Aktiv genutzt:                                       │
│  app_data           — JSON-Blob (komplette App-Daten)     │
│  app_data_history   — Tägliche Snapshots (30 Tage)        │
│  users              — Auth-Stammdaten + 2FA-Secrets       │
│  share_links        — Public-Read-Tokens                  │
│  audit_log          — Append-only Audit-Trail             │
│                                                          │
│  ─── Vorbereitet (database/azubiboard.sql), aktuell       │
│      via JSON-Blob abgebildet — wartet auf L5-Refactor:   │
│  projects, tasks, project_assignments, project_steps,     │
│  reports, report_entries, report_files, materials,        │
│  requirements, groups, group_members, departments,        │
│  netzplan_nodes, netzplan_edges, calendar_events,         │
│  notifications, time_entries, sessions,                   │
│  quizzes, quiz_questions, quiz_answers, quiz_attempts,    │
│  quiz_attempt_answers, learn_categories                   │
└──────────────────────────────────────────────────────────┘
```

**Wichtig zur Architektur:**
Das System läuft **dual** — entweder als reines Frontend (localStorage, `VITE_USE_API=false`)
oder mit PHP-Backend. Im API-Modus wird der **komplette App-State als ein JSON-Objekt** in
`app_data.content` gespeichert (Single-Row-Tabelle). Der Backend-Endpoint `POST /api/data`
überschreibt diesen Blob; Conflict-Detection läuft über `updated_at`-ETag + `If-Match`-Header.

Die `database/azubiboard.sql` enthält ein **vollständigeres normalisiertes Schema** (mit FKs,
Indizes, etc.), das aktuell **noch nicht aktiv ist**. Der Refactor von JSON-Blob auf normalisiertes
Schema steht als **Sprint 12 (Item L5)** in der Roadmap.

---

## 📅 Sprint-Historie (zeitlich neuester zuerst)

| Sprint | Commit | Themen | Status |
|---|---|---|---|
| **Session 18.05** | `74e017e` | BackupsModal: „Aktuellen Stand herunterladen"-Button (Live-JSON); install_ubuntu.sh Schritt 7/8: mysqldump-Cron tägl. 03:00 → /var/backups/azubiboard/, 30 Tage Retention; Projekt-Tab default Listenansicht; CLAUDE.md Arbeitsregeln (12 Regeln, Karpathy Rules 1–4 verbatim) | ✅ |
| **Bugfix** | `7005654` | Projekt-Karten Hover-Actions immer sichtbar (inline display:flex Override) + position:relative fix; GET /api/data/backups/{day} unerreichbar (Routing-Reihenfolge); install_ubuntu.sh: php-mysql-Check + mod_expires | ✅ |
| **11/M1** | `ded875a` | PDF-OCR Import (Tesseract.js + pdfjs-dist, lazy), Berichtseditor-Button | ✅ |
| **11** | `8945b72` | C2 Lernpfade (DAG, Schema v5), C3 SM-2 Karteikarten, C1 Quiz-Editor, F-Quality useDebounce, F-a11y Skip-Link+Focus-Trap | ✅ |
| **10** | `56b69d7` | M2 Mentor-Rolle (roles.js), K2-Backend Field-Level Permissions, K4 ClamAV, M3 weekly_digest.php | ✅ |
| **9.5** | `b15e94f` | B1 Partial-Token Single-Use DB (5min TTL), B2 2FA-Disable mit TOTP, B5 JWT-jti Logout-Blocklist | ✅ |
| **9-Quality** | `2187b9c` | ErrorBoundary pro Route, Dashboard-Refactor 11 Widget-Files, BoundingRect-Cache, silent-catch | ✅ |
| **8** | `8b07bbd` | Audit-Log Server-Tabelle, 2FA TOTP, CSP-Härtung | ✅ |
| **7** | `115035c` | Sentry, Server-Backups (täglich, 30d), Migrations v1–3, SW-Background-Sync | ✅ |
| **6** | `d51fd3f` | Bulk-Import Lernziele, IHK-PDF, Public-Share-Links, Code-Splitting, GitHub-Actions CI, Push-Notifications | ✅ |
| **5** | `f152826` | Conflict-Detection (If-Match), Soft-Delete + Papierkorb, Playwright E2E | ✅ |
| **4** | `9d9e850` | Smart-Polling-Sync statt SSE (FastCGI-tauglich) | ✅ |
| **1–3** | div. | Backend-Hardening, Rate-Limit, Retry-Queue, Vitest, ISO-Wochen, Mobile-DnD, Toast-Undo | ✅ |
| **früher** | div. | Kanban, Ausbildungsplan, Zeiterfassung, Jahresmappe, Cockpit, Avatar, Labels, iCal | ✅ |

**Was bei einer neuen Session zu wissen ist:**

- **Sprint 4** sollte ursprünglich SSE liefern, wurde auf Polling umgestellt (PHP-FastCGI verträgt keine persistenten Verbindungen).
- **Sprint 7+8** sind die "Production-Härtung" — Tracking, Backups, Migrations, Audit, 2FA, CSP.
- **Sprint 10** hat die Mentor-Rolle als ENUM in die DB gebracht (`roles.js` mit `isStaff/isAusbilder/isMentor`).
- **Schema-Versionen:** `data.schema_version` aktuell **v5** — migrations v1–v5 in `src/lib/migrations.js`.
  - v4: Custom-Quiz aus localStorage → `data.quizzes`
  - v5: `data.learningPaths`, `data.pathProgress` für Lernpfade
- **OCR-Import**: Tesseract.js + pdfjs-dist werden **dynamisch** importiert (erst wenn Button geklickt). Erster Aufruf lädt ~10 MB Sprachpaket von CDN, danach browser-gecacht.
- **Dashboard** ist in 11 Widget-Dateien aufgeteilt: `src/features/dashboard/widgets/`.

---

## 🎯 Nächster Sprint — Sprint 12: MySQL-Schema-Refactor (XL, 3–5 Tage)

| | Item | Details |
|---|---|---|
| **L5** | JSON-Blob → relationale Tabellen | `projects`, `tasks`, `reports`, `goals` als eigene MySQL-Tabellen |
| | Feature-Flag | `VITE_USE_SCHEMA=true` für schrittweise Migration ohne Downtime |
| | Row-Level Security | Ausbilder sieht nur Azubis seiner Gruppe |
| | Volltextsuche | `FULLTEXT INDEX` auf reports.content, tasks.title |

**Voraussetzung für Sprint 12:** L5 blockiert Multi-Tenant (M4) und granulare Backups. Nicht parallel zu anderen Features starten.

### 🐞 Querschnitts-Item

| | Item | Aufwand |
|---|---|---|
| **OPS1** | OneDrive-Preflight-Hook: vor jedem Build/Commit Clash-Files automatisch entfernen. Spart bei jedem Sync-Konflikt ~10 min Debugging. | S |

---

## 🛡️ Was die App jetzt kann (Sprint 8 — Status quo)

**Auth:**
- Login + Register, bcrypt (cost 12), JWT (HS256, 7 Tage default)
- 2FA via TOTP (Google Authenticator etc.) + Recovery-Codes
- Rate-Limiting (8 Login-Versuche / 15 min pro IP)
- Passwort min. 8 Zeichen
- Session-Restore via JWT, kein Server-Side-Storage

**Daten-Pipeline:**
- Save-Queue mit Exp-Backoff (1s → 30s)
- Optimistic Updates (localStorage sofort, Server async)
- Conflict-Detection via ETag/If-Match → 409 mit Server-State + UI-Dialog
- Smart-Polling alle 25s für Multi-User (pausiert in Background-Tab)
- Background-Sync via Service Worker (Saves überleben Tab-Close + Offline-Reconnect)
- Tägliche Server-Snapshots (30 Tage Retention), Restore-UI für Ausbilder
- Schema-Migrations mit `data.schema_version` (3 Steps bereits implementiert)
- Soft-Delete + Papierkorb (30 Tage Retention) für Projekte/Berichte/Lernziele
- Audit-Log: jede Activity-Eintragung wird automatisch an Server gespiegelt

**Features:**
- **Dashboard**: Azubi-Sicht (Aufgaben, Stunden, Berichte) + Ausbilder-Cockpit (alle Azubis, Ampel-System, Monatsreport-PDF)
- **Projekte**: Pool mit Filter + Status, Detail mit Tabs (Aufgaben Kanban+List, Anforderungen, Material, Netzplan, Gantt, Burndown)
- **Aufgaben**: Drag&Drop Kanban (Mobile + Keyboard), Zeiterfassung pro Task, Labels mit Farbfilter, Bulk-Actions
- **Berichtshefte**: Wochen-Reports mit ISO-KW-korrekt, PDF-Druck (Standard + IHK-Format mit Stammdaten + Unterschriftenfeldern), Jahresmappe, Public-Share-Link, Auto-Fill aus Aufgaben
- **Ausbildungsplan**: Lernziele nach Lehrjahr/Quartal/Kategorie, Status open→learned→confirmed, Kompetenz-Ring, IHK-Prüfungs-Countdown, Bulk-Import (CSV/JSON/Vorlagen)
- **Kalender**: Wochen-/Monatsansicht, Task-Deadlines, iCal-Export
- **Lernportal (`/learn`)**: Quiz-Erstellung + Spielen (rudimentär — Phase C aufgeschoben)
- **Azubi-Profilseite (`/azubi/:id`)**: Stunden-Sparkline (8 Wochen), Berichts-Historie, Lernziele-Fortschritt
- **Papierkorb**: Restore + endgültig-Löschen (Ausbilder), 30-Tage-Countdown
- **Globale Suche** (Ctrl+K)
- **Keyboard-Shortcuts**: G+D/P/K/R/U, N=Neues Projekt, ?=Hilfe
- **Theme**: Auto-Detect OS, Manual-Override, in DB persistiert (API-Modus)
- **PWA**: Installierbar, Offline-fähig, Background-Sync
- **i18n-Scaffold**: DE-Default, EN als Stub vorhanden (~50 Strings übersetzt, Vollmigration steht aus)
- **Browser-Notifications**: Permission-Flow + Toggle, nur wenn Tab im Hintergrund
- **Backup-Reminder**: alle 7 Tage gelber Banner mit Export-CTA
- **Sentry-Integration** (opt-in via `VITE_SENTRY_DSN`)
- **GitHub-Actions CI**: Unit + E2E + Lighthouse

---

## ☁️ Cloud-Deploy

**Komplette Anleitung in [DEPLOY.md](./DEPLOY.md).** Drei Optionen:

| | Stack | Kosten | Trigger |
|---|---|---|---|
| **Netlify** | Frontend-only (localStorage) | 0 € | Auto-Deploy bei Push to `main` + Manual via `workflow_dispatch` |
| **Cloudflare Pages** | Frontend-only (localStorage) | 0 € | Auto-Deploy bei Push |
| **Klassisches Hosting** | PHP + MySQL via SFTP | ~3-5 €/Mon | Nur manueller `workflow_dispatch` (Schutz vor Versehen) |

**Vorhandene Workflows:**
- `.github/workflows/deploy-netlify.yml` — Build mit konfigurierbarem `VITE_USE_API` + `VITE_API_BASE_URL`, Deploy via [nwtgck/actions-netlify](https://github.com/nwtgck/actions-netlify). Secrets: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
- `.github/workflows/deploy-sftp.yml` — SFTP-Upload für klassisches PHP-Hosting. Schreibt `.env` zur Build-Zeit aus GitHub-Secrets. Bestätigung mit Tippen von `DEPLOY` erforderlich. Secrets: `SFTP_HOST/PORT/USERNAME/PASSWORD/REMOTE_DIR`, `DB_*`, `JWT_SECRET`, `ALLOWED_ORIGIN`.

**Setup-Reihenfolge für eine Live-Production-Site:**
1. Klassisches Hosting buchen (Hostinger ~3€/Mon empfohlen)
2. MariaDB-Datenbank im Hoster-Panel anlegen, `database/azubiboard.sql` via phpMyAdmin importieren
3. GitHub-Secrets gemäß [DEPLOY.md → Option C](./DEPLOY.md#-option-c--klassisches-webhosting-php--mysql) eintragen
4. Actions → "Deploy → Klassisches Webhosting (SFTP)" → "Run workflow" → `DEPLOY` tippen → Run
5. Erstes Account registrieren, dann via SQL zu `ausbilder` machen
6. 2FA aktivieren

## 🧪 Tests

| Suite | Anzahl | Dauer | Ort |
|---|---|---|---|
| **Vitest Unit** | 44 Tests in 4 Files | ~2.5s | `tests/*.test.js` |
| **Playwright E2E** | 6 Tests in 2 Specs | ~5s | `e2e/*.spec.js` |
| **Lighthouse CI** | Performance/A11y/Best-Practices/SEO | ~30s | `lighthouserc.cjs` (warn-level Schwellen) |

**Tests sind in CI verlinkt** — siehe `.github/workflows/ci.yml`.

```bash
npm test           # einmaliger Run
npm run test:watch # watch mode
npm run test:ui    # vitest UI
npm run e2e        # Playwright (braucht chromium)
npm run e2e:ui     # Playwright UI
```

---

## 🔧 Wichtige Architektur-Entscheidungen + Gotchas

### 1. `setData` ist **wholesale replace** (kein Merge)
Konsumenten **müssen** `{ ...data, foo: ... }` spreaden. Sprint-1-Bug war ein fehlender Spread,
der `projects`/`users`/etc. überschrieben hat. Es gibt einen Regression-Test
(`tests/store-merge.test.js`).

### 2. ISO-8601 Kalenderwochen
`getKW`/`getISOWeek` in `src/lib/utils.js`. Wichtig für Berichtshefte:
KW1 von 2026 = 29.12.2025–04.01.2026. Tests in `tests/utils.test.js`.

### 3. JSON-Blob vs. Schema
Aktuell ist alles im JSON-Blob (`app_data.content`). Die `database/azubiboard.sql` zeigt
das **Ziel-Schema** für L5. Der Refactor ist nicht trivial — ca. 30 Touchpoints im Frontend.

### 4. OneDrive-Sync-Konflikte
Der Projektordner liegt in OneDrive. Bei Konflikten (gleichzeitig auf zwei Geräten geöffnet)
erzeugt OneDrive Dateien wie `App (# Name clash 2026-XX-XX XXX #).jsx`. Diese sind in
`.gitignore` ignoriert. **Bei jedem `git pull` ggf. prüfen:**
```bash
find . -name "*Name clash*" -not -path "./node_modules/*" -not -path "./dist/*"
```
Wenn welche existieren: prüfe ob byte-identisch zu HEAD; wenn ja, löschen.

### 5. Routes-Splitting
Alle Routes außer Dashboard sind `lazy()`-geladen. Initial-Bundle ~130 KB gz statt ~190 KB.
Bei neuen Routes ebenso `lazy()` + `Suspense`-Fallback.

### 6. Sentry ist opt-in
Ohne `VITE_SENTRY_DSN` ist die SDK ein No-Op — kein Crash, keine Daten gesendet.

### 7. Sicherheits-Header
`.htaccess` setzt CSP, COOP, CORP, HSTS. **Vor Production-Deploy testen** dass der
PWA-Service-Worker nicht durch CSP blockiert wird (sollte über `worker-src 'self'` OK sein).

### 8. 2FA-Spalten in `users`-Tabelle
Werden bei jedem `auth.php`-Call versucht zu erstellen (idempotent via `IF NOT EXISTS`).
Bei MySQL < 8.0 müssen sie manuell angelegt werden:
```sql
ALTER TABLE users
  ADD COLUMN totp_secret        VARCHAR(64) DEFAULT NULL,
  ADD COLUMN totp_enabled       TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN totp_recovery_hash TEXT        DEFAULT NULL,
  ADD COLUMN totp_activated_at  TIMESTAMP   NULL DEFAULT NULL;
```

### 9. PWA-Manifest & Dev-Mode
`vite-plugin-pwa` ist im Dev-Modus deaktiviert (`devOptions.enabled: false`).
Service Worker läuft nur in `vite preview` und Production.

### 10. E2E benötigt `vite preview`
Die Playwright-Tests laufen gegen den Produktions-Bundle (vite preview auf Port 4173),
nicht gegen den Dev-Server — deterministischer und kompatibler mit Workbox.

---

## 🔐 Sicherheits-Stand (Sprint 8)

| Bereich | Schutz |
|---|---|
| **Auth** | bcrypt cost 12, JWT HS256, optional 2FA TOTP + Recovery-Codes |
| **Brute-Force** | Rate-Limit pro IP (file-basiert): 8 Login/15min, 5 Register/h, 8 2FA/15min |
| **Input** | Längenbegrenzung (clean_str/clean_int), Whitelist für Enum-Werte, JSON-Body max 10 MB |
| **Transport** | HTTPS-Redirect via .htaccess, HSTS 1 Jahr |
| **Headers** | CSP (script-src 'self', frame-ancestors none, etc.), COOP/CORP same-origin, Permissions-Policy strict |
| **CORS** | exakte Origin-Whitelist (kein Wildcard), Credentials enabled, exposed: ETag/Retry-After |
| **DB** | PDO Prepared Statements überall, eigener DB-User (nicht root) |
| **Datei-Upload** | MIME-Sniff per finfo, 10 MB cap, Avatar nur Bilder |
| **Audit** | append-only Log mit IP+UA, 365 Tage Retention, indexed |
| **Backups** | täglich 30 Tage, restore-fähig |

**Bekannte Lücken (Roadmap):**
- K2 — Field-Level-Permissions fehlen (jeder Ausbilder kann jedes Feld jedes Berichts ändern)
- K4 — Upload-MIME nur per Magic-Bytes geprüft, kein Virenscanner
- L5 — JSON-Blob hat keine Row-Level-Security

---

## 🌐 Environment-Variablen

Siehe `.env.example`. Wichtigste:

| Variable | Default | Zweck |
|---|---|---|
| `VITE_USE_API` | `true` | true = PHP-Backend, false = nur localStorage |
| `VITE_BASE_PATH` | `/azubiboard/` | URL-Prefix (XAMPP-Subdir vs. eigene Domain) |
| `VITE_SENTRY_DSN` | leer | Error-Tracking opt-in |
| `VITE_APP_VERSION` | `dev` | Release-Tag für Sentry |
| `DB_HOST/PORT/NAME/USER/PASS` | localhost-Defaults | MariaDB-Verbindung |
| `JWT_SECRET` | **PFLICHT** | min. 32 random Zeichen, `openssl rand -hex 32` |
| `JWT_EXPIRY` | `604800` | 7 Tage in Sekunden |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | CORS-Whitelist, exakt 1 Origin |
| `APP_ENV` | `production` | Aktiviert Detail-Errors nur in `development` |
| `MAX_FILE_MB` | `10` | Avatar-Upload-Limit |

---

## 📁 Wichtige Dateien-Übersicht

```
.
├── .env.example              # Setup-Vorlage (DB, JWT, Sentry, …)
├── .github/workflows/ci.yml  # Unit + E2E + Lighthouse CI
├── .htaccess                 # SPA-Routing + Security-Headers
├── HANDOVER.md               # ★ DIESES Dokument
├── README.md                 # Top-Level-Intro
├── ROADMAP.md                # Original-Roadmap (älter, hier in HANDOVER ersetzt)
├── database/
│   ├── azubiboard.sql        # ★ Vollständiges DB-Schema (Sprint 9 Ziel)
│   ├── setup.sql             # Minimal-Setup (Sprint 1-8 Basis)
│   └── seed.php              # Test-Daten-Seeding
├── api/
│   ├── index.php             # Router
│   ├── config.php            # Auth + TOTP + Rate-Limit-Helper
│   └── routes/
│       ├── auth.php          # /api/auth/*  + 2FA
│       ├── data.php          # /api/data    + Backups + Conflict
│       ├── users.php         # /api/users
│       ├── share.php         # /api/share   (Public Read-Links)
│       └── audit.php         # /api/audit   (Audit-Log)
├── src/
│   ├── App.jsx               # Root + Routing (>1300 Zeilen)
│   ├── main.jsx              # Vite-Entry + i18n + Sentry-Init
│   ├── lib/                  # Pure-Logik (testbar)
│   │   ├── dataService.js    # Save-Queue + API
│   │   ├── utils.js          # ISO-KW + Helfer
│   │   ├── trash.js          # Soft-Delete
│   │   ├── migrations.js     # Schema-Migrations
│   │   ├── i18n.js           # react-i18next
│   │   ├── sentry.js         # Error-Tracking
│   │   ├── webPush.js        # Browser-Notifications
│   │   ├── backup.js         # Backup-Reminder
│   │   └── useDataSync.js    # Smart-Polling
│   ├── components/           # Reusable UI
│   ├── features/             # Domain-Module
│   └── locales/              # de.json, en.json
├── tests/                    # Vitest
├── e2e/                      # Playwright
├── playwright.config.js
├── vitest.config.js
├── lighthouserc.cjs          # Lighthouse-CI
├── vite.config.js            # Vite + PWA + BackgroundSync
└── package.json
```

---

## 🤝 Wie du mit der nächsten Claude-Session arbeitest

**Empfohlener Einstieg:**

```
Hi Claude, ich arbeite an AzubiBoard weiter. Lies bitte zuerst:
1. HANDOVER.md  — kompletter Projektstand
2. README.md    — Top-Level
3. ROADMAP.md   — historische Roadmap (älter)

Aktueller Stand: Sprint 8 abgeschlossen (8b07bbd).
Nächste sinnvolle Schritte sind in HANDOVER.md unter "Roadmap V" beschrieben.

Was ich jetzt machen möchte: [hier deine Aufgabe]
```

**Wenn du Sprint 9 (L5 MySQL-Schema-Refactor) starten willst:** Großer Brocken, plan ca. 3-5 Tage.
Das vollständige Ziel-Schema steht in `database/azubiboard.sql`. Refactor-Strategie:
1. Backend-Routes (api/routes/projects.php, tasks.php, reports.php, goals.php, materials.php, …) anlegen
2. dataService.js mit neuen Methoden ergänzen (parallel zur Blob-Methode)
3. Feature-für-Feature migrieren mit Feature-Flag (`VITE_USE_SCHEMA=true`)
4. Tests pro Migration anpassen
5. Wenn alle Features migriert: Blob-Endpunkt deprecaten, dann entfernen

**Wenn du Sprint 10 (Adoption-Features) machst:** Weniger riskant, sichtbarer Nutzen.
Reihenfolge: M3 (Wochenmail) → K2 (Permissions) → M2 (Mentor-Rolle) → K4 (Upload-Härtung).

---

## 📞 Bei Problemen

- **Build/Test schlägt fehl:** Erst Clash-Files prüfen (siehe Gotcha 4)
- **CSP blockiert was:** Browser-Devtools-Console → "Refused to …" → CSP in `.htaccess` anpassen
- **2FA broken:** TOTP-Code akzeptiert ±1 step Drift (60s Window). Wenn Geräteuhren weiter abweichen, Window in `totp_verify` in `api/config.php` erhöhen
- **DB-Migration fehlt:** Bei MySQL <8.0 die `ALTER TABLE`-Statements aus Gotcha 8 manuell laufen lassen
- **Sentry zeigt nichts:** `VITE_SENTRY_DSN` in `.env` setzen + `npm run build`

---

**Repo:** https://github.com/OGBullZ/AzubiBoard.git
**Branch:** `main`
**Letzter grüner Build:** `74e017e` · ~470 KB / 140 KB gz (index) + 415 KB (pdf lazy) · Build ✅
