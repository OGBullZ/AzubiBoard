# AzubiBoard — Roadmap

> Stand: 18. Mai 2026 · Letzter Commit: `07adee0` · Schema v5
> Vollständige Sprint-Historie → `HANDOVER.md`

---

## ✅ Abgeschlossen (alle Sprints bis Session 18.05)

| Sprint | Commit | Highlights |
|---|---|---|
| Session 18.05 | `07adee0` | Backup-Cron (mysqldump, tägl. 03:00), Download-aktuell-Button, Projekt-Liste-Default, CLAUDE.md 12 Arbeitsregeln |
| 11.5 M1 | `ded875a` | PDF-OCR (Tesseract.js + pdfjs-dist, lazy) |
| 11 | `8945b72` | Lernpfade (DAG, Schema v5), SM-2 Karteikarten, Quiz-Editor, a11y Pass 2 |
| 10 | `56b69d7` | Mentor-Rolle, Field-Level Permissions server-side, ClamAV-Hook, Weekly-Digest-Cron |
| 9.5 | `b15e94f` | Partial-Token Single-Use DB, 2FA-Disable mit TOTP, JWT-jti Logout-Blocklist |
| 9-Q | `2187b9c` | ErrorBoundary pro Route, Dashboard-Refactor (11 Widgets), Perf-Fixes |
| 8 | `8b07bbd` | 2FA TOTP + Recovery, Audit-Log Server, CSP-Härtung |
| 1–7 | div. | Backend-Hardening, Rate-Limit, Backups, Migrations, Conflict-Detection, Papierkorb, CI |

---

## 🔥 Sofort-Maßnahmen (XS · kein Sprint-Planning nötig)

Diese Items können einzeln, unabhängig voneinander erledigt werden.

| ID | Item | Aufwand | Warum jetzt |
|---|---|---|---|
| **OPS1** | Pre-commit Hook: OneDrive-Clash-Files | XS · 30 min | Verhindert `*Name clash*`-Bugs vor jedem Push automatisch |
| **DEV1** | Slash Commands anlegen | S · 1h | `/review`, `/rot`, `/tests`, `/doc-update` in `.claude/commands/` — Claude-Produktivität |
| **OPS9** | HTTPS + Let's Encrypt auf Server | S · 1h | Produktionsbetrieb ohne HTTPS ist kein Produktionsbetrieb |
| **OPS10** | Auto-Deploy-Script (git pull + build) | M · 2–3h | Server manuell aktualisieren nervt; Cron zieht `main` automatisch |

### OPS1 — Pre-commit Hook Detail

```bash
# .git/hooks/pre-commit (oder husky)
files=$(find . -name "*Name clash*" \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" 2>/dev/null)
if [ -n "$files" ]; then
  echo "⚠ OneDrive-Clash-Files gefunden:"
  echo "$files"
  echo "Bitte prüfen und löschen, dann erneut committen."
  exit 1
fi
```

### DEV1 — Slash Commands

```
.claude/commands/
  review.md     → Code-Review des letzten Commits
  rot.md        → Technische Schulden im aktuellen Diff identifizieren
  tests.md      → Tests für geänderte Dateien generieren
  doc-update.md → HANDOVER.md + CLAUDE.md nach Änderungen updaten
```

---

## 🏗️ Sprint 12 — MySQL-Schema-Refactor (L5) · XL · 3–5 Tage

> **Kernproblem:** Alles lebt in `app_data.content` als ein JSON-Blob.
> Das blockiert: Row-Level-Security, Volltextsuche, Audit pro Entität, Multi-Tenant.
> **Abhängigkeit:** Alle künftigen Backend-Features hängen daran. Zuerst erledigen.

### Strategie: Feature-Flag + Dual-Write

```
Phase 1: Neue Tabellen + Backend-Routes (kein Frontend-Eingriff)
Phase 2: Dual-Write — Frontend schreibt in Blob UND neue Tabellen
Phase 3: Frontend liest aus neuen Tabellen (Feature-Flag VITE_USE_SCHEMA=true)
Phase 4: Blob-Endpoints deprecaten + entfernen
```

### Tasks

| ID | Item | Details |
|---|---|---|
| **L5-1** | Migration-Script | Bestehenden Blob → neue Tabellen überführen. Backup davor Pflicht. Idempotent (re-run-sicher) |
| **L5-2** | `api/routes/projects.php` | CRUD für `projects` + `tasks` + `project_assignments` |
| **L5-3** | `api/routes/reports.php` | CRUD für `reports` + `report_entries` + `report_files` |
| **L5-4** | `api/routes/goals.php` | CRUD für `requirements` + `materials` |
| **L5-5** | `dataService.js` erweitern | Neue Methoden parallel zu Blob-Methoden (kein Breaking-Change) |
| **L5-6** | Row-Level Security | `WHERE group_id = $auth_group` in allen Ausbilder-Queries |
| **L5-7** | Volltextsuche | `FULLTEXT INDEX` auf `reports.content`, `tasks.title` — `/api/search?q=` Endpoint |
| **L5-8** | Tests anpassen | Vitest + Playwright auf neue API-Endpunkte |

### Akzeptanzkriterien

- [ ] Alle 44 Unit-Tests grün
- [ ] Alle 6 E2E-Tests grün
- [ ] Ausbilder sieht nur Azubis seiner eigenen Gruppe
- [ ] Suche liefert Ergebnisse über Projekte + Berichte + Aufgaben
- [ ] Kein Datenverlust bei Migration (verified: Snapshot vorher, Count-Check nachher)

---

## 📦 Sprint 13 — Qualität + DevOps · M–L · ~1 Woche

> Nach L5 erledigen — manche Items setzen relationale Tabellen voraus.

| ID | Item | Aufwand | Abhängigkeit |
|---|---|---|---|
| **I1** | i18n Vollmigration (DE/EN) | M · 1 Tag | — · ~300 verbleibende Strings |
| **T1** | TypeScript: schrittweise `.jsx → .tsx` | XL · 3+ Tage | — · Zod-Schemas für API-Boundaries zuerst |
| **OPS3** | Deploy-Key + Auto-Deploy auf Server | M · halber Tag | — · `git fetch` + Cron statt manuellem Upload |
| **Q1** | PHP-Unit-Tests (PHPUnit) | M · 1 Tag | — · `api/config.php` + `data.php` haben null Coverage |
| **Q2** | Lighthouse-Schwellen verschärfen | S · 2h | — · aktuell warn-only |
| **SEC1** | Fail2ban + UFW auf Server | S · 1h | OPS9 |
| **N1** | E-Mail-Benachrichtigungen via SMTP | M · 1 Tag | — · `weekly_digest.php` nutzt native `mail()`, braucht PHPMailer |

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
Diese Woche:  OPS1 + DEV1 (Hooks + Slash Commands)   ~1.5h
              OPS9 (HTTPS auf Server)                  ~1h
Nächste Woche: Sprint 12 (L5 Refactor)                ~3–5 Tage
              OPS10 (Auto-Deploy)                      ~2–3h
Danach:       Sprint 13 (Quality-Sprint)               ~1 Woche
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
