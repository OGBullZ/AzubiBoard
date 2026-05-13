# 🎓 AzubiBoard

> Ausbildungs-Management-Tool für Azubi-Projekte, Aufgaben, Berichtshefte, Ausbildungspläne und Lernportale.

**React 19 + Vite 7 + PHP 8.2 + MariaDB** · PWA · 2FA · Multi-User-Sync · CI

[![CI](https://github.com/OGBullZ/AzubiBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/OGBullZ/AzubiBoard/actions/workflows/ci.yml)

---

## 📋 Komplette Projekt-Übergabe

**→ [HANDOVER.md](./HANDOVER.md) lesen** — Architektur, Sprint-Historie, Roadmap, Setup, Gotchas.

Speziell wichtig wenn du auf einem neuen Laptop oder mit einer neuen Claude-Code-Session startest.

---

## 🚀 Schnellstart

```bash
git clone https://github.com/OGBullZ/AzubiBoard.git
cd AzubiBoard
npm install
cp .env.example .env       # → DB-Pass + JWT-Secret eintragen
mysql -u root -p azubiboard < database/azubiboard.sql   # optional, sonst VITE_USE_API=false
npm run dev                # http://localhost:5173/azubiboard/
```

**Demo-Login (lokal):** `ausbilder@firma.de` oder `anna@azubi.de` · Passwort `12345678`

## 🛠️ Verfügbare Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Vite Dev-Server (Port 5173) |
| `npm run build` | Production-Bundle nach `dist/` |
| `npm run preview` | Built-Bundle serven |
| `npm test` | Vitest Unit-Tests (44) |
| `npm run test:watch` | Vitest Watch-Mode |
| `npm run test:ui` | Vitest UI |
| `npm run e2e` | Playwright E2E (6) |
| `npm run e2e:ui` | Playwright UI |
| `npm run lint` | ESLint |

## 📦 Was die App kann

- **Projekt-Management:** Kanban (Drag&Drop), Liste, Anforderungen, Material, Netzplan, Gantt, Burndown
- **Aufgaben:** Zeiterfassung, Labels, Bulk-Actions, Mobile + Keyboard-DnD
- **Berichtshefte:** ISO-konforme KW, IHK-konformes PDF-Format, Jahresmappe, Public-Share, Auto-Fill
- **Ausbildungsplan:** Lernziele nach Lehrjahr/Quartal, Kompetenz-Ringe, Prüfungs-Countdown, Bulk-Import (CSV/JSON/Vorlagen)
- **Dashboard:** Azubi-Sicht + Ausbilder-Cockpit mit Ampel-System, Monatsreport-PDF
- **Kalender:** Wochen-/Monatsansicht, Task-Deadlines, iCal-Export
- **Auth:** Login + Register, 2FA via TOTP + Recovery-Codes, Rate-Limiting
- **Daten-Integrität:** Conflict-Detection (If-Match), Save-Queue mit Backoff, Background-Sync via Service Worker, tägliche Server-Snapshots (30 Tage)
- **Audit-Log:** Append-only Server-Side Trail
- **Sicherheit:** CSP, HSTS, COOP/CORP, bcrypt, JWT
- **PWA:** Installierbar, Offline-fähig
- **i18n-Scaffold:** DE/EN (Vollmigration WIP)
- **Browser-Notifications, Theme-Auto-Switch, Global-Search (Ctrl+K), Keyboard-Shortcuts**

## ☁️ Cloud-Deploy

**3 Optionen** — siehe [DEPLOY.md](./DEPLOY.md):

| | Backend | Kosten | Setup |
|---|---|---|---|
| **A** Netlify (Frontend-only) | ❌ localStorage | 0 € | 5 min |
| **B** Cloudflare Pages | ❌ localStorage | 0 € | 5 min |
| **C** Klassisches PHP-Webhosting | ✅ vollständig | ~3-5 €/Mon | 30-60 min |

Beide Workflows (`deploy-netlify.yml`, `deploy-sftp.yml`) haben **`workflow_dispatch`** — manueller Trigger via GitHub-Actions-UI.

## 🗺️ Roadmap

Siehe [HANDOVER.md → Roadmap V](./HANDOVER.md#-roadmap-v--offene-items). Nächste Schritte:

- **Sprint 9 — L5:** MySQL-Schema aktivieren (Refactor weg von JSON-Blob, Voraussetzung für Multi-Tenant)
- **Sprint 10 — Adoption:** Wochenmail (M3), Mentor-Rolle (M2), Field-Permissions (K2)
- **Sprint 11 — Power:** PDF-OCR-Import (M1), Quiz + Karteikarten (C1+C3)

## 📂 Struktur

```
api/             PHP-Backend (routes/, config.php)
database/        Schema (azubiboard.sql) + Setup
src/
  App.jsx        Root + Routing
  lib/           Pure-Logik (testbar)
  components/    Reusable UI
  features/      Domain-Module (projects, reports, training, …)
  locales/       i18n (de.json, en.json)
tests/           Vitest Unit-Tests
e2e/             Playwright E2E
```

## 🤝 Lizenz

Privates Projekt. Keine öffentliche Lizenz festgelegt.

---

**Letzter grüner Build:** Sprint 8 (`8b07bbd`) · 765 KB / 139 KB gz · 44/44 unit · 6/6 E2E
