# AzubiBoard — Ziele bis „v1.0 / quasi fertig"

> Stand: 8. Juni 2026 · `main = 9d4a000` · Schema v5
> Scope: **v1.0 production-done** — die großen Vision-Features (Multi-Tenant, IHK-API,
> RBAC, Offline-PWA) gehören bewusst NICHT dazu (siehe unten).

> **UX-/Design-Roadmap (war Prio 1) ist ✅ abgeschlossen** (Phase 0,1,2,4 live; Phase 3 Mobile out-of-scope).
> **Aktueller Arbeitsstrang = Willkommens-/News-Fenster** (`WELCOME-FENSTER-DESIGN.md`, Phase 0+1 auf Branch
> `welcome-news`). Tier 1 (Server-Verifikation) bleibt parallel und braucht das Deployment.

**Kernlage:** Code-seitig ist nahezu alles fertig. Was „fertig" noch blockt, ist
überwiegend **Live-Verifikation gegen den echten Ubuntu-Server** (`10.14.99.10`) —
keine MariaDB / kein MTA / kein lauffähiges lokales Playwright in der Dev-Umgebung.

Legende: **[Server]** = braucht echtes Deployment · **[hier]** = ohne Server machbar

---

## Tier 1 — Live-Verifikation (Code fertig, nie gegen echte Umgebung gelaufen)

| # | Ziel | Verify | Wo | Status |
|---|---|---|---|---|
| 1 | Sprint 12 Phase 3: `VITE_USE_SCHEMA=true` gegen echte MariaDB | alle 6 Feature-Pfade (Projekte/Reports/Kalender/Lernpfade/Quiz/Trainingsplan) laden korrekt aus relationalen Routes | [Server] | offen |
| 2 | Migration `migrate_blob_to_relational.php` gegen echten Blob | Count-Check vor/nach identisch (Projects/Tasks/Reports/Goals), Re-Run idempotent | [Server] | offen |
| 3 | Row-Level-Security live | 2 Ausbilder versch. Gruppen → A sieht B's Daten nicht | [Server] | offen |
| 4 | Dual-Write live (`BACKEND_DUAL_WRITE=true`) | Blob-Save → relationale Tabellen + `audit_log` gefüllt | [Server] | offen |

## Tier 2 — Funktionale Lücke

| # | Ziel | Verify | Wo | Status |
|---|---|---|---|---|
| 5 | **N1** — E-Mail via PHPMailer/SMTP statt native `mail()` (macht `cron/weekly_digest.php` produktionsfähig) | Mail kommt an / PHPUnit-Mock auf SMTP-Transport | [hier] bauen, [Server] testen | offen |

## Tier 3 — Server-Hardening

| # | Ziel | Wo | Status |
|---|---|---|---|
| 6 | **SEC1** — Fail2ban + UFW auf Ubuntu-Server | [Server] | offen |

## Tier 4 — Housekeeping

| # | Ziel | Wo | Status |
|---|---|---|---|
| 7 | `ROADMAP.md` aktualisieren (war auf 18.05/`5aa9707`) | [hier] | ✅ erledigt 05.06 |
| 8 | CI Node-Bump 20→22 erledigt; `nwtgck/actions-netlify@v3`→`@v4` (node24-Runtime) gebumpt → erzwungener Cutover 16.06.2026 bricht den Auto-Deploy nicht mehr | [hier] | ✅ erledigt 08.06 |
| 9 | ~30 silent-catches durchgehen (latente Bugs, niedrige Prio) | [hier] | offen |
| 10 | Sprint-12-Akzeptanzkriterien-Checkboxen final abhaken (nach Tier 1) | [hier] | offen |

---

## Explizit NICHT „quasi fertig" (das ist v2 / Vision)

| ID | Item |
|---|---|
| **M4** | Multi-Tenant |
| **M5** | IHK-Direktanbindung |
| **SEC2** | RBAC-Granularität (Permissions per Feature) |
| **MOB1** | Offline-PWA verbessern |

---

## Engpass

Tier 1 (4 Punkte) ist in **einer** Sitzung verifizierbar, sobald ein Ubuntu-Deployment
mit MariaDB steht. Bis dahin sind nur Tier 2/3/4 vom Dev-PC aus bewegbar.
