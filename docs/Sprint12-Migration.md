# Sprint 12 — Blob ↔ Relational Cross-Check

**Stand:** 2026-05-20 (Phase 0 rückwirkend, nach Phase-1-Commit `c326c1e`)
**Zweck:** Inventar aller Datenfelder, die heute im LocalStorage-Blob `app_data.content` leben, gegen die existierenden SQL-Tabellen in `database/azubiboard.sql`. Lücken sind die ToDo-Liste für Phase 2 (Dual-Write) und Phase 3 (Frontend-Migration).

---

## Blob-Struktur (Schema v5, aus `src/lib/migrations.js`)

Top-Level-Keys, die in `data` (= `app_data.content`) erwartet werden:

| Blob-Key | Eingeführt in | Inhalt |
|---|---|---|
| `schema_version` | v0 | Nummer (Migration-Anker) |
| `projects[]` | v0 | Projekte mit eingebetteten `tasks[]`, `requirements[]`, `materials[]` |
| `reports[]` | v0 | Wochen-/Tagesberichte |
| `calendarEvents[]` | v1 | Kalender-Einträge |
| `trash` | v2 | Soft-Delete-Bin: `{ projects:[], reports:[], goals:[] }` |
| `trainingPlan` | v2 | `{ goals:[], examDate }` — Lernziele + IHK-Datum |
| `activityLog[]` | v2 | Audit-Trail (Frontend-seitig) |
| `quizzes[]` | v4 | Quiz-Definitionen mit Fragen + Antworten |
| `learningPaths[]` | v5 | Lernpfade (DAG-Voraussetzungs-Graph) |
| `pathProgress` | v5 | `{ pathId → { nodeId → status } }` |
| `_migrationsApplied`, `_lastMigratedAt`, `_migrationError` | Meta | Migration-Bookkeeping, **nicht migrieren** |

---

## SQL-Tabellen (aus `database/azubiboard.sql`, 25 Tabellen)

| Tabelle | Schlüssel-Spalten | Verwendung |
|---|---|---|
| `users` | id, role, group-FKs via group_members | Auth, Rollen (`azubi`/`mentor`/`ausbilder`) |
| `sessions` | id, user_id, expires_at | Auth-Sessions |
| `departments` / `groups` / `group_members` | Hierarchie | Mehrmandanten-Vorbereitung |
| `projects` | id, **group_id**, created_by | L5-2 Migration-Ziel |
| `project_assignments` | (project_id, user_id) | RLS-Basis |
| `project_steps` | id, project_id, step_date | **SQL-only — kein Blob-Pendant** |
| `tasks` | id, project_id, assigned_to | L5-2 Migration-Ziel |
| `requirements` | id, project_id | L5-4 Migration-Ziel |
| `materials` | id, project_id | L5-4 Migration-Ziel |
| `reports` | id, user_id, week_start | L5-3 Migration-Ziel |
| `report_entries` | id, report_id, entry_date | **SQL-only — Blob hat alles in `activities`/`learnings`** |
| `report_files` | id, report_id, file_path | **SQL-only — Blob hat `file` als einzelnes Objekt** |
| `calendar_events` | id, user_id | **kein Migration-Script-Pfad** |
| `quizzes` / `quiz_questions` / `quiz_answers` / `quiz_attempts` / `quiz_attempt_answers` | Quiz-Schema (5 Tabellen) | **kein Migration-Script-Pfad — Blob hat alles in einem `quizzes[]`-Array** |
| `time_entries` | id, project_id, task_id, user_id | **SQL-only — Blob speichert `timeLog` inline in tasks** |
| `netzplan_nodes` / `netzplan_edges` | id, project_id | **SQL-only — kein Blob-Pendant** |
| `notifications` | id, user_id | **SQL-only — Blob hat keinen Notifications-Store** |
| `learn_categories` | id, name | **SQL-only — kein Blob-Pendant (separater Lern-Bereich)** |

---

## Lücken-Matrix (Was Phase 1 NICHT migriert hat)

Das Phase-1-Migration-Script `database/migrate_blob_to_relational.php` (Commit `c326c1e`) deckt nur 5 Entitäten ab:
**projects, tasks, requirements, materials, reports** — und sogar diese unvollständig.

### A) Blob-Felder ohne SQL-Migrationspfad (Phase 1 ignoriert sie)

| Blob-Feld | Risiko | Notwendige Aktion |
|---|---|---|
| `data.quizzes[]` (inkl. Fragen + Antworten) | **HOCH** — Quiz-Editor schreibt seit Sprint 11 in den Blob | Phase 2: Migration-Script erweitern um Quizzes → `quizzes` + `quiz_questions` + `quiz_answers`. ID-Mapping für Quiz-IDs nötig. |
| `data.learningPaths[]` + `data.pathProgress` | **HOCH** — Sprint 11 Feature, lebt ausschließlich im Blob | **Schema-Erweiterung nötig:** neue Tabellen `learning_paths`, `learning_path_nodes`, `learning_path_edges`, `learning_path_progress`. Migration P2-X. |
| `data.calendarEvents[]` | **MITTEL** — Kalender-Feature seit v1 | Phase 2: Migration-Script erweitern um `calendar_events`. Schema existiert bereits. |
| `data.trainingPlan` (`goals[]`, `examDate`) | **MITTEL** — Azubi-Profil-Ansicht zieht daraus | **Schema-Lücke:** keine `training_plans`-Tabelle. Entweder neue Tabelle oder `user_profile`-JSON-Spalte. |
| `data.trash` (Soft-Delete) | **MITTEL** — J3 Papierkorb | **Schema-Lücke:** kein Soft-Delete im Schema (kein `deleted_at`-Feld in projects/reports). Phase 2 muss `deleted_at TIMESTAMP NULL` zu projects/reports/requirements ergänzen. |
| `data.activityLog[]` | **NIEDRIG** — Frontend-Cache des Server-Audit-Logs | Bleibt im Blob als Cache, server-side `audit_log` (Sprint 8 K5) ist Source-of-Truth. **Doku-Eintrag in HANDOVER.md.** |
| Task-Inline `timeLog[]` | **HOCH** — Zeiterfassung-Feature | Phase 2: Migration-Script erweitern um Task→time_entries-Aufspaltung. |
| Report-Inline `file` (Objekt) | **MITTEL** — PDF-Upload | Phase 2: Migration-Script erweitern um File→report_files. |
| Report-Inline Tages-Einträge | **MITTEL** — wenn `activities` als JSON-Array vorliegt | Cross-Check nötig: Sind `report_entries` heute überhaupt befüllt oder nur das `activities`-Textfeld? |

### B) SQL-Tabellen ohne Blob-Quelle (würden leer migriert)

| Tabelle | Bedeutung | Auswirkung |
|---|---|---|
| `project_steps` | Schritte im Netzplan-Modus | Frontend nutzt vermutlich `tasks` als steps — prüfen ob `project_steps` überhaupt befüllt wird, sonst **entfernen** (Schema-Cleanup). |
| `netzplan_nodes` / `netzplan_edges` | Netzplan-Gantt-Backend | Heute komplett Frontend-berechnet aus tasks. Tabellen sind **toter Code** im Schema → Cleanup-Kandidat oder Phase-3-Migration-Target wenn server-side gerendert werden soll. |
| `notifications` | Persistente Notifications | Wird vermutlich von WebPush (Sprint 6 J7) befüllt — orthogonal zur Blob-Migration. |
| `learn_categories` | Quiz-Kategorien | Separate Verwaltung — orthogonal. |
| `quiz_attempts` / `quiz_attempt_answers` | Quiz-Versuchs-Historie | Heute Frontend-only (vermutlich in `pathProgress` oder localStorage). **Hohe Lücke** wenn Statistiken serverseitig laufen sollen. |

### C) Bugs im bereits gepushten Migration-Script

(Aus Code-Review 2026-05-20, dokumentiert in [[project-azubiboard]])

1. **`group_id = NULL`** für alle Projekte (Z.132) → RLS-Bruch für Gruppen-Mitglieder.
   **Fix in Phase 2:** Aus `created_by` → `users.group_id` → `projects.group_id` ableiten, oder dedizierten Mapping-Parameter ergänzen.
2. **Keine Transaktion** um Projekt + Children → halb-migrierte Datensätze möglich.
   **Fix:** `$pdo->beginTransaction()` pro Projekt-Block.
3. **Kein Pre-Flight-Check** auf Ziel-Tabellen-Existenz → unfreundliche PDO-Exception.
   **Fix:** `SHOW TABLES LIKE 'projects'` + `die("Schema nicht migriert. Erst azubiboard.sql laufen lassen.")`.
4. **Silent Date-Drops** in `safe_date()`/`safe_ts()` → unsichtbarer Datenverlust.
   **Fix:** Bei `strtotime() === false`: `error_log()` mit Original-Wert + Blob-ID.

---

## Akzeptanzkriterien Phase 0 (P0-2)

- [x] Vollständiges Inventar aller Blob-Top-Level-Keys
- [x] Vollständiges Inventar aller 25 SQL-Tabellen
- [x] Lücken-Matrix mit Risiko-Klassifizierung (HOCH/MITTEL/NIEDRIG)
- [x] Konkrete Fix-Hinweise für bekannte Phase-1-Bugs
- [x] Dokumentierte Schema-Erweiterungen für Phase 2/3 (Lernpfade, training_plans, deleted_at)

---

## Implikationen für die Roadmap

**Phase 1 ist gegen ROADMAP-Erwartung unvollständig.** Das ROADMAP-Item L5-1 (Migration-Script) hat als Akzeptanz nur "Blob → relational, idempotent" — was technisch erfüllt ist —, aber faktisch fehlen die Hälfte der Entitäten (Quizzes, Lernpfade, Kalender, Zeit, Files). Das war nicht aus der ROADMAP herauslesbar; die Lücke wird hier dokumentiert.

**Empfehlung für Phase 2 (Dual-Write):**
- Neu-Sequenz: erst Schema-Erweiterungen (`deleted_at`-Felder, `learning_paths`-Tabellen, ggf. `training_plans`), dann Migration-Script-Erweiterung, **dann erst** Dual-Write-Routes.
- Sonst migriert Phase 2 in halb-leere Tabellen und Phase 3 hat keine Daten zum Frontend-Anschluss.

**Empfehlung für Phase 3 (Frontend):** Reihenfolge der 6 Feature-Migrationen anpassen — was migriert ist, kann nach SQL umziehen; was nicht migriert ist, muss im Blob bleiben bis Phase 2 nachzieht.
