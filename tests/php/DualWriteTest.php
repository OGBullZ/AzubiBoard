<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Sprint 12 Phase 2 (P2-3 / L5-5): Dual-Write-Orchestrator migrate_blob_entities().
 *
 * Prüft, dass ein kompletter App-Blob konsistent (insert-only) in die
 * relationalen Tabellen gespiegelt wird und wiederholte Saves idempotent sind.
 * Läuft gegen In-Memory-SQLite (gleiche Strategie wie MigrationFunctionsTest).
 */
#[CoversNothing]
final class DualWriteTest extends TestCase
{
    private static bool $helpersLoaded = false;
    private PDO $pdo;
    private array $blob;

    public static function setUpBeforeClass(): void
    {
        if (!self::$helpersLoaded) {
            require_once AZUBI_ROOT . '/database/migration_helpers.php';
            self::$helpersLoaded = true;
        }
    }

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->buildSchema();
        $this->seedUsers();

        $json = file_get_contents(AZUBI_ROOT . '/tests/fixtures/blob_realistic.json');
        $this->blob = json_decode($json, true);
        $this->assertIsArray($this->blob, 'Fixture muss valides JSON sein');
    }

    private function buildSchema(): void
    {
        $this->pdo->exec("CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT
        )");
        $this->pdo->exec("CREATE TABLE groups (id INTEGER PRIMARY KEY, type TEXT)");
        $this->pdo->exec("CREATE TABLE group_members (group_id INTEGER, user_id INTEGER)");

        // Volle Projekt-/Task-/Requirement-/Material-/Report-Tabellen
        // (deckt alle Spalten ab, die migrate_projects/migrate_reports schreiben).
        $this->pdo->exec("CREATE TABLE projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER, created_by INTEGER, title TEXT, description TEXT,
            status TEXT, priority TEXT, start_date TEXT, deadline TEXT,
            netzplan_unit TEXT, color TEXT, archived INTEGER DEFAULT 0
        )");
        $this->pdo->exec("CREATE TABLE project_assignments (
            project_id INTEGER, user_id INTEGER, assigned_by INTEGER,
            PRIMARY KEY (project_id, user_id)
        )");
        $this->pdo->exec("CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, assigned_to INTEGER, created_by INTEGER,
            title TEXT, description TEXT, note TEXT, doc TEXT, protocol TEXT,
            status TEXT, priority TEXT, due_date TEXT, estimated_minutes INTEGER,
            completed_at TEXT, sort_order INTEGER DEFAULT 0
        )");
        $this->pdo->exec("CREATE TABLE requirements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, title TEXT, description TEXT, done INTEGER DEFAULT 0,
            priority TEXT, sort_order INTEGER DEFAULT 0, completed_at TEXT
        )");
        $this->pdo->exec("CREATE TABLE materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, name TEXT, description TEXT, quantity REAL,
            unit TEXT, unit_cost REAL, supplier TEXT, ordered INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0
        )");
        $this->pdo->exec("CREATE TABLE reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, reviewer_id INTEGER, week_start TEXT, week_number INTEGER,
            year INTEGER, title TEXT, activities TEXT, learnings TEXT, status TEXT,
            submitted_at TEXT, reviewed_at TEXT, signed_at TEXT, reviewer_comment TEXT,
            file_url TEXT, signed_file_url TEXT
        )");

        // P2-2-Entitäten
        $this->pdo->exec("CREATE TABLE quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_by INTEGER, title TEXT, description TEXT,
            difficulty TEXT, time_limit_sec INTEGER, is_public INTEGER DEFAULT 1
        )");
        $this->pdo->exec("CREATE TABLE quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER, question_text TEXT, question_type TEXT,
            explanation TEXT, points INTEGER, sort_order INTEGER
        )");
        $this->pdo->exec("CREATE TABLE quiz_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER, answer_text TEXT, is_correct INTEGER, sort_order INTEGER
        )");
        $this->pdo->exec("CREATE TABLE time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, task_id INTEGER, user_id INTEGER,
            description TEXT, started_at TEXT, ended_at TEXT
        )");
        $this->pdo->exec("CREATE TABLE calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, project_id INTEGER, title TEXT, description TEXT,
            event_date TEXT, start_time TEXT, end_time TEXT, all_day INTEGER DEFAULT 1,
            type TEXT, color TEXT, source TEXT DEFAULT 'manual', external_id TEXT
        )");
        $this->pdo->exec("CREATE TABLE report_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER, user_id INTEGER,
            filename TEXT, original_name TEXT, file_path TEXT,
            file_size INTEGER, mime_type TEXT, upload_type TEXT DEFAULT 'report'
        )");

        migration_ensure_map_table($this->pdo);
        // learning_paths* + deleted_at + users.training_plan
        apply_phase2_schema($this->pdo);
    }

    private function seedUsers(): void
    {
        $this->pdo->exec("INSERT INTO users (id, name, role) VALUES (1, 'Azubi A', 'azubi')");
        $this->pdo->exec("INSERT INTO users (id, name, role) VALUES (2, 'Ausbilder B', 'ausbilder')");
    }

    private function rowCount(string $table): int
    {
        return (int)$this->pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
    }

    // ─────────────────────────────────────────────────────────────

    public function testDualWriteMirrorsWholeBlobConsistently(): void
    {
        $stats = migrate_blob_entities($this->pdo, $this->blob);

        // Projekte: 5 mit id. Tasks: 3+4+3+1 = 11 (Task ohne id wird übersprungen).
        $this->assertSame(5, $stats['projects']);
        $this->assertSame(11, $stats['tasks']);
        $this->assertSame(6, $stats['requirements']);
        $this->assertSame(3, $stats['materials']);
        $this->assertSame(1, $stats['time_entries']); // task_001 hat 1 timeLog-Eintrag

        // Reports: 10 gesamt, 3 unmigrierbar (user 999 / week_start null / user_id null) → 7.
        $this->assertSame(7, $stats['reports']);
        $this->assertSame(2, $stats['report_files']); // rep_001 (Objekt) + rep_002 (String)

        // P2-2-Entitäten (gleiche Erwartungen wie MigrationFunctionsTest)
        $this->assertSame(1, $stats['quizzes']);
        $this->assertSame(5, $stats['quiz_questions']);
        $this->assertSame(12, $stats['quiz_answers']);
        $this->assertSame(2, $stats['learning_paths']);
        $this->assertSame(7, $stats['learning_path_nodes']);
        $this->assertSame(6, $stats['learning_path_edges']);
        $this->assertSame(6, $stats['learning_path_progress']); // 3 done-Nodes × 2 User
        $this->assertSame(3, $stats['calendar_events']);
        $this->assertSame(1, $stats['training_plan_users']);

        // Stats spiegeln die tatsächlichen Tabellen-Inhalte (Blob ↔ Relational konsistent).
        $this->assertSame(5, $this->rowCount('projects'));
        $this->assertSame(11, $this->rowCount('tasks'));
        $this->assertSame(6, $this->rowCount('requirements'));
        $this->assertSame(3, $this->rowCount('materials'));
        $this->assertSame(7, $this->rowCount('reports'));
        $this->assertSame(2, $this->rowCount('report_files'));
        $this->assertSame(1, $this->rowCount('time_entries'));
        $this->assertSame(3, $this->rowCount('calendar_events'));

        // Ersteller wird jedem Projekt mit auflösbarer user_id zugewiesen (RLS-Basis).
        // proj_mno345 hat keine user_id → kein Assignment → 4 statt 5.
        $this->assertSame(4, $this->rowCount('project_assignments'));
    }

    public function testDualWriteIsIdempotent(): void
    {
        migrate_blob_entities($this->pdo, $this->blob);
        $second = migrate_blob_entities($this->pdo, $this->blob);

        // Zweiter Lauf mit identischem Blob legt nichts Neues an.
        $this->assertSame(0, $second['projects']);
        $this->assertSame(0, $second['tasks']);
        $this->assertSame(0, $second['requirements']);
        $this->assertSame(0, $second['materials']);
        $this->assertSame(0, $second['reports']);
        $this->assertSame(0, $second['report_files']);
        $this->assertSame(0, $second['quizzes']);
        $this->assertSame(0, $second['learning_paths']);
        $this->assertSame(0, $second['calendar_events']);

        // Tabellen-Stand unverändert nach zweitem Lauf.
        $this->assertSame(5, $this->rowCount('projects'));
        $this->assertSame(11, $this->rowCount('tasks'));
        $this->assertSame(7, $this->rowCount('reports'));
    }

    public function testNewEntityOnSecondSaveIsAppended(): void
    {
        migrate_blob_entities($this->pdo, $this->blob);
        $this->assertSame(5, $this->rowCount('projects'));

        // Zweiter Save mit einem zusätzlichen Projekt — nur das Neue wird angelegt.
        $this->blob['projects'][] = [
            'id' => 'proj_new_999', 'title' => 'Nachzügler-Projekt', 'user_id' => 1,
            'status' => 'green', 'tasks' => [], 'requirements' => [], 'materials' => [],
        ];
        $stats = migrate_blob_entities($this->pdo, $this->blob);

        $this->assertSame(1, $stats['projects']);
        $this->assertSame(6, $this->rowCount('projects'));
    }

    public function testProjectRollbackDoesNotLeavePartialRows(): void
    {
        // tasks-Tabelle wegnehmen → Task-Insert wirft → ganze Projekt-Transaktion
        // muss zurückgerollt werden (kein verwaistes Projekt/Assignment).
        $this->pdo->exec("DROP TABLE tasks");

        $blob = ['projects' => [[
            'id' => 'proj_x', 'title' => 'Mit Tasks', 'user_id' => 1, 'status' => 'green',
            'tasks' => [['id' => 't1', 'text' => 'Task A']],
            'requirements' => [], 'materials' => [],
        ]]];

        $stats = migrate_projects($this->pdo, $blob['projects']);

        $this->assertSame(0, $stats['projects']);
        $this->assertSame(1, $stats['skipped']);
        $this->assertSame(0, $this->rowCount('projects'));
        $this->assertSame(0, $this->rowCount('project_assignments'));
        // Mapping-Eintrag darf ebenfalls nicht bestehen bleiben.
        $mapped = (int)$this->pdo->query("SELECT COUNT(*) FROM migration_blob_id_map WHERE entity_type='project'")->fetchColumn();
        $this->assertSame(0, $mapped);
    }
}
