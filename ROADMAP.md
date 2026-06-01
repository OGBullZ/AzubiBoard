# AzubiBoard — Roadmap

> Stand: 18. Mai 2026 (Session 2) · Letzter Commit: `5aa9707` · Schema v5
> Vollständige Sprint-Historie → `HANDOVER.md`

---

## ✅ Abgeschlossen (alle Sprints bis Session 18.05.2)

| Sprint | Commit | Highlights |
|---|---|---|
| Session 18.05.2 | `5aa9707` | Test-Fix `migrations.test.js` auf v5 (CI war 18 Commits lang rot!), ESLint-Config Node+Vitest-Globals + ignoreRestSiblings, unused-imports cleanup; Lint 76→57 Errors |
| Session 18.05b | `33a1a05` | OPS9 HTTPS/Let's Encrypt + OPS10 Auto-Deploy-Cron in install_ubuntu.sh; OPS1 Pre-commit Hook (.githooks/); DEV1 Slash Commands (/review /rot /tests /doc-update) |
| Session 18.05 | `07adee0` | Backup-Cron (mysqldump, tägl. 03:00), Download-aktuell-Button, Projekt-Liste-Default, CLAUDE.md 12 Arbeitsregeln |
| 11.5 M1 | `ded875a` | PDF-OCR (Tesseract.js + pdfjs-dist, lazy) |
| 11 | `8945b72` | Lernpfade (DAG, Schema v5), SM-2 Karteikarten, Quiz-Editor, a11y Pass 2 |
| 10 | `56b69d7` | Mentor-Rolle, Field-Level Permissions server-side, ClamAV-Hook, Weekly-Digest-Cron |
| 9.5 | `b15e94f` | Partial-Token Single-Use DB, 2FA-Disable mit TOTP, JWT-jti Logout-Blocklist |
| 9-Q | `2187b9c` | ErrorBoundary pro Route, Dashboard-Refactor (11 Widgets), Perf-Fixes |
| 8 | `8b07bbd` | 2FA TOTP + Recovery, Audit-Log Server, CSP-Härtung |
| 1–7 | div. | Backend-Hardening, Rate-Limit, Backups, Migrations, Conflict-Detection, Papierkorb, CI |

---

## ✅ Sofort-Maßnahmen — alle erledigt

| ID | Item | Status |
|---|---|---|
| **OPS1** | Pre-commit Hook: OneDrive-Clash-Files | ✅ `.githooks/pre-commit` + `package.json prepare` |
| **DEV1** | Slash Commands | ✅ `.claude/commands/` — `/review` `/rot` `/tests` `/doc-update` |
| **OPS9** | HTTPS + Let's Encrypt auf Server | ✅ `install_ubuntu.sh` Schritt 8/9 (optional, mit Domain) |
| **OPS10** | Auto-Deploy-Script | ✅ `install_ubuntu.sh` Schritt 8/9 — Cron alle 10 min, Log |

---

## ✅ Sprint 12 — MySQL-Schema-Refactor (L5) · XL · abgeschlossen 2026-06-01

> **Kernproblem:** Alles lebt in `app_data.content` als ein JSON-Blob.
> Das blockiert: Row-Level-Security, Volltextsuche, Audit pro Entität, Multi-Tenant.
> **Abhängigkeit:** Alle künftigen Backend-Features hängen daran. Zuerst erledigen.
> **Entscheidung 18.05:** Vollständige Migration in einem Sprint (alle 6 Feature-Bereiche). PHPUnit wird in Phase 0 mit-aufgesetzt (Q1 aus S13 vorgezogen). FULLTEXT-Suche wandert nach Sprint 13.

### Strategie: Feature-Flag + Dual-Write in 5 Phasen

```
Phase 0: Vorbereitung (PHPUnit, Cross-Check, Test-Fixture, Backup-Sanity)
Phase 1: Read-only Routes mit PHPUnit-Tests (kein Frontend-Eingriff)
Phase 2: Dual-Write Backend + Row-Level-Security
Phase 3: Frontend Migration aller 6 Features (Feature-Flag VITE_USE_SCHEMA)
Phase 4: Cleanup — Blob-Endpoint mit 410 Gone deprecaten
```

### Phase 0 — Vorbereitung (~3-4 Std)

| ID | Item | Details |
|---|---|---|
| **P0-1** | PHPUnit installieren | `composer require --dev phpunit/phpunit` (oder zip-Bundle wenn kein Composer), `phpunit.xml` aufsetzen, smoke-test gegen `api/config.php` |
| **P0-2** | Cross-Check Blob ↔ Schema | Walk-through: welche Frontend-Felder existieren nur im Blob (z.B. `learningPaths`, `pathProgress` v5), welche nur im SQL-Schema (z.B. `quiz_attempt_answers`). Lücken in `docs/Sprint12-Migration.md` dokumentieren |
| **P0-3** | Realistic Test-Fixture | `tests/fixtures/blob_realistic.json`: 5 Projekte mit ~20 Tasks/Requirements/Materials, 10 Reports, 30 Goals, 1 Quiz mit 5 Fragen, 2 Lernpfade |
| **P0-4** | Backup-Sanity | Manuell `mysqldump`-Cron ausführen, Restore in Sandbox-DB verifizieren |

### Phase 1 — Backend Read-Only (~1 Tag, ~5 Commits)

Neue Routes existieren, lesen aus Tabellen via JOIN, schreiben noch nicht. Frontend unverändert.

| Commit | Item | Tests (PHPUnit) |
|---|---|---|
| **L5-1** | `database/migrate_blob_to_schema.php` (idempotent, dry-run-Flag, count-verification, transaktional pro Entitäten-Block) | happy / empty-blob / partial-data / re-run idempotency |
| **L5-2** | `api/routes/projects.php` GET-only (mit tasks + requirements + materials + assignments JOIN) | happy / not-found / permission-deny |
| **L5-3** | `api/routes/reports.php` GET-only (mit entries + files JOIN) | happy / not-own-azubi / status-filter |
| **L5-4** | `api/routes/goals.php` GET-only (requirements + materials) | happy / project-not-found |
| **L5-Q1** | PHPUnit-Run in `.github/workflows/ci.yml` integrieren | (CI grün) |

### Phase 2 — Dual-Write Backend + Row-Level-Security (~1 Tag, ~4 Commits)

| Commit | Item | Tests |
|---|---|---|
| **L5-5** | `data.php` Dual-Write-Switch (Env: `BACKEND_DUAL_WRITE=true`) → POST schreibt in Blob UND Tabellen, atomar via Transaktion | PHPUnit: blob+tables konsistent nach Save |
| **L5-5b** | `dataService.js`: zusätzliche ETags pro Entität, ohne Verhalten zu ändern (forward-compat) | Vitest |
| **L5-6a** | `with_group_filter($sql, $user)` Helper + Refactor aller Ausbilder-Queries in `data.php`/`users.php` | PHPUnit: User aus Gruppe A sieht keine Daten von B |
| **L5-6b** | Audit-Log Eintrag pro Entitäts-Mutation (statt nur Blob-Mutation) | PHPUnit: Audit-Row pro Save |

### Phase 3 — Frontend Migration (~1.5 Tage, ~6 Commits)

`VITE_USE_SCHEMA=true` → Frontend liest aus neuen Endpoints. Reihenfolge nach Risiko (geringstes zuerst):

| Commit | Feature | Touchpoints (geschätzt) |
|---|---|---|
| **L5-FE1** | groups + departments | GroupsView, UsersView, AzubiProfilePage |
| **L5-FE2** | calendar_events | CalendarView, iCal-Export, Task-Deadline-Sync |
| **L5-FE3** | projects + tasks + requirements + materials (Hauptlast) | ProjectPool, ProjectDetail (alle Tabs), Dashboard-Widgets |
| **L5-FE4** | reports + entries + files (Hauptlast) | ReportsPage, IHK-PDF, Share-Links, PDF-OCR-Import |
| **L5-FE5** | netzplan_nodes + edges | NetzplanGantt |
| **L5-FE6** | quizzes + learningPaths + flashcards | LearnPage, LernpfadeView, Quiz-Editor |

Pro Commit: Browser-Test der gold-Pfade, Vitest-Update auf neue API.

### Phase 4 — Cleanup (~0.3 Tag, ~2 Commits) ✅ DONE

| Commit | Item | Status |
|---|---|---|
| **L5-DEP** | `2b1c325` — FORCE_SCHEMA=true → POST /api/data 410 Gone + Deprecation-Header bei GET | ✅ |
| **L5-DOC** | HANDOVER.md (neue Routes, 3-Modi-Architektur, Sprint-12-Historie) + ROADMAP.md | ✅ |

### Rollback je Phase

- **Phase 1**: Routes löschen — keine Auswirkung
- **Phase 2**: `BACKEND_DUAL_WRITE=false` — Blob bleibt Source-of-Truth, Tabellen stale
- **Phase 3**: `VITE_USE_SCHEMA=false` — Frontend nutzt wieder Blob
- **Phase 4**: 410-Logik revert

### Akzeptanzkriterien

- [ ] Alle bestehenden Vitest-Tests grün (aktuell 44)
- [ ] Mind. 25 neue PHPUnit-Tests grün (5+ pro Route)
- [ ] Alle 6 Playwright E2E grün + 1 neue "Schema-Migration"-Spec
- [ ] Ausbilder sieht nur Azubis seiner eigenen Gruppe (Row-Level-Security verifiziert)
- [ ] Migration-Script: Count-Check vor/nach (Projects, Tasks, Reports, Goals) → identisch
- [ ] CI + Netlify-Deploy grün auf jedem einzelnen Commit (gh-cli prüft automatisch)

---

## 📦 Sprint 13 — Qualität + DevOps · M–L · ~1 Woche

> Nach L5 erledigen — manche Items setzen relationale Tabellen voraus.

| ID | Item | Aufwand | Abhängigkeit |
|---|---|---|---|
| **L5-7** | FULLTEXT-Suche | M · halber Tag | L5 · Index auf `reports.content`+`tasks.title`, `/api/search?q=` Endpoint, Ctrl+K nutzt ihn (war in S12 geplant, verschoben) |
| **I1** | i18n Vollmigration (DE/EN) | M · 1 Tag | — · ~300 verbleibende Strings |
| **T1** | TypeScript: schrittweise `.jsx → .tsx` | XL · 3+ Tage | — · Zod-Schemas für API-Boundaries zuerst |
| **OPS3** | Deploy-Key + Auto-Deploy auf Server | M · halber Tag | — · `git fetch` + Cron statt manuellem Upload |
| ~~**Q1**~~ | PHPUnit | — | **In Sprint 12 Phase 0 vorgezogen** |
| **Q2** | Lighthouse-Schwellen verschärfen | S · 2h | — · aktuell warn-only |
| **SEC1** | Fail2ban + UFW auf Server | S · 1h | OPS9 |
| **N1** | E-Mail-Benachrichtigungen via SMTP | M · 1 Tag | — · `weekly_digest.php` nutzt native `mail()`, braucht PHPMailer |
| **LINT** | react-hooks Warnings beheben (NetzplanGantt refs-during-render, exhaustive-deps in mehreren useEffect) | S · 2h | — · 4 Warnings + ~30 silent-catches sind potentielle Latent-Bugs |

---

## 🔮 Sprint 14+ — Vision & Skalierung

> Große Features, die L5 + Sprint 13 voraussetzen.

| ID | Item | Aufwand | Voraussetzung |
|---|---|---|---|
| **M4** | Multi-Tenant | XL | L5 + Row-Level-Security |
| **M5** | IHK-Direktanbindung | XL | Öffentliche API muss existieren |
| **AI1** | Auto-Fill Berichte aus Aufgaben (KI) | L | L5 — braucht Volltextindex |
| **AI2** | Lernziel-Vorschläge via Claude API | M | L5 |
| **MOB1** | Progressive-Web-App verbessern (Offline-Modus) | M | — |
| **UX1** | Onboarding-Flow (erster Login → Setup-Wizard) | M | — |
| **SEC2** | RBAC-Granularität (Permissions per Feature) | L | L5 |

---

## 📊 Abhängigkeits-Übersicht

```
Sofort-Maßnahmen (OPS1, DEV1, OPS9, OPS10)  ← jetzt, unabhängig
        │
        ▼
Sprint 12: L5 MySQL-Refactor  ← BLOCKER für alles darunter
        │
        ├──► Row-Level-Security (L5-6)
        ├──► Volltextsuche (L5-7)
        │
        ▼
Sprint 13: Quality + DevOps
        │
        ├──► i18n (I1)
        ├──► TypeScript (T1)
        ├──► PHP-Tests (Q1)
        │
        ▼
Sprint 14+: Vision
        │
        ├──► Multi-Tenant (M4)
        ├──► IHK-API (M5)
        └──► KI-Features (AI1, AI2)
```

---

## ⚡ Empfohlene Reihenfolge

```
Erledigt:     OPS1 + DEV1 + OPS9 + OPS10 (alle in install_ubuntu.sh)
Erledigt:     Pre-Release-Hygiene (Test-Fix v5, ESLint-Config, gh-cli)
Erledigt:     Sprint 12 (L5 Refactor) — Phase 0–4 komplett (2026-06-01)
Aktuell:      Sprint 13 (Quality + L5-7 FULLTEXT + LINT) ~1 Woche
Offen:        Sprint 14+ nach Bedarf
```

---

## 📏 Aufwands-Legende

| Symbol | Bedeutung |
|---|---|
| XS | < 1 Stunde |
| S | 1–3 Stunden |
| M | halber bis 1 ganzer Tag |
| L | 1–2 Tage |
| XL | 3–5 Tage |
