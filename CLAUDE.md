# CLAUDE.md — Anleitung für Claude Code

> Diese Datei wird automatisch von Claude Code zu Beginn jeder Session gelesen.
> Sie liefert kompakten Kontext; für tiefere Details auf `HANDOVER.md` verweisen.

## Projekt

**AzubiBoard** — Ausbildungs-Management-Tool. React 19 + Vite 7 + PHP 8.2 + MariaDB. PWA mit 2FA, Multi-User-Sync, Conflict-Detection und Audit-Log.

Repository: https://github.com/OGBullZ/AzubiBoard

## Stand

**Sprint 8 abgeschlossen** (Commit `8b07bbd`, 12. Mai 2026):
- Sicherheits-Härtung mit Server-Audit-Log, 2FA (TOTP), CSP-Header
- 765 KB Build / 139 KB gz · 44/44 Unit-Tests · 6/6 Playwright-E2E

**Vor Sprint 8 abgeschlossen:** L3 Sentry, L4 Server-Backups, L2 Migrations, L1 Background-Sync (Sprint 7); Bulk-Import, IHK-PDF, Share-Links, Code-Splitting, GitHub-CI, Push-Notifications (Sprint 6); Conflict-Detection, Papierkorb, E2E-Smoke (Sprint 5); Polling-Sync (Sprint 4); Backend-Hardening, Backup-Reminder, i18n-Scaffold (Sprint 3); Save-Queue, Audit-Frontend, Vitest (Sprint 2); Kritische Bugfixes + Mobile-DnD (Sprint 1).

**Vollständige Sprint-Historie + Roadmap → `HANDOVER.md`**
**Cloud-Deploy-Anleitung → `DEPLOY.md`** (3 Optionen: Netlify, Cloudflare, klassisches Webhosting via SFTP-Workflow)

## Arbeitsweise

1. **Vor jeder größeren Aktion `HANDOVER.md` konsultieren** — dort steht die Architektur, alle Gotchas, und welche Items in welcher Reihenfolge sinnvoll sind.
2. **OneDrive-Sync-Konflikte sind ein wiederkehrendes Thema.** Wenn `git status` seltsam aussieht oder Dateien fehlen, zuerst nach `*Name clash*`-Dateien suchen und ggf. aufräumen. Details in `HANDOVER.md` → Gotcha 4.
3. **Tests immer mitlaufen lassen:** `npm test && npm run build` vor jedem Commit. E2E (`npm run e2e`) bei größeren Änderungen.
4. **Setze auf `lazy()` + `Suspense`** für neue große Routes — Code-Splitting ist etabliert.
5. **Daten-Pattern:** `setData({ ...data, foo: ... })` — niemals nur `{ foo: ... }`, sonst Datenverlust (Sprint-1-Lesson).

## Datenbank

- **`database/azubiboard.sql`** ist das vollständige Ziel-Schema (Sprint 9 / L5).
- Aktuell aktiv genutzt: `users`, `app_data` (JSON-Blob), `app_data_history`, `share_links`, `audit_log` — werden via `CREATE TABLE IF NOT EXISTS` selbst angelegt.
- Restliche Tabellen aus dem Schema warten auf den L5-Refactor.

## Was als Nächstes sinnvoll ist

Aus Roadmap V (siehe HANDOVER.md):

| Sprint | Item | Aufwand |
|---|---|---|
| **9** ⚠️ | **L5** — MySQL-Schema aktivieren (Refactor JSON-Blob → normalisiert) | 3-5 Tage |
| **10** | **M3** Wochenmail, **M2** Mentor-Rolle, **K2** Field-Permissions | 2-3 Tage |
| **11** | **M1** PDF-OCR-Import, **C1+C3** Quiz + Karteikarten | 4-5 Tage |
| **12+** | **M4** Multi-Tenant, **M5** IHK-API (Vision) | groß |

User-Wunsch ist meistens **Sprint 10** (Adoption) vor Sprint 9 (großer Refactor), da Sprint 9 viel Aufwand für wenig sichtbaren Nutzer-Win ist.

## Wichtige Pfade

- `src/App.jsx` — Root, Routing, Bootstrap
- `src/lib/dataService.js` — API/Save-Queue/Conflict
- `src/lib/utils.js` — ISO-KW, Datums-Helfer
- `api/routes/*.php` — Backend
- `database/azubiboard.sql` — Ziel-Schema
- `tests/*.test.js` — Vitest
- `e2e/*.spec.js` — Playwright

## Build/Test-Commands

```bash
npm install
npm run dev       # Vite Dev-Server
npm test          # Vitest (44 Tests)
npm run e2e       # Playwright (6 Tests, braucht Chromium)
npm run build     # Produktions-Bundle
```

## Wenn die User-Anfrage unklar ist

Frag nach. Nicht raten. Insbesondere:
- "Sprint X starten" → Frage was X enthalten soll, Roadmap konsultieren
- "Roadmap" → `HANDOVER.md` lesen, dann Vorschlag
- "fix das Problem" → reproduzieren, nicht vermuten
