<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Sprint 12 Phase 2 (P2-2): migrate_* Funktionen pro Entität.
 *
 * Tests laufen gegen In-Memory-SQLite. Schema wird minimal nachgebaut
 * (ohne FK/Generated-Columns, da SQLite die MariaDB-Syntax dafür nicht hat).
 */
#[CoversNothing]
final class MigrationFunctionsTest extends TestCase
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

        // Fixture laden — dieselbe wie FixtureTest, deckt alle Edge-Cases.
        $json = file_get_contents(AZUBI_ROOT . '/tests/fixtures/blob_realistic.json');
        $this->blob = json_decode($json, true);
        $this->assertIsArray($this->blob, 'Fixture muss valides JSON sein');
    }

    private function buildSchema(): void
    {
        // Basis-Tabellen die die migrate_*-Funktionen brauchen.
        $this->pdo->exec("CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT
        )");
        // apply_phase2_schema fügt deleted_at zu projects/reports/requirements hinzu — Stub-Tabellen anlegen.
        $this->pdo->exec("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)");
        $this->pdo->exec("CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER)");
        $this->pdo->exec("CREATE TABLE requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, title TEXT)");
        $this->pdo->exec("CREATE TABLE groups (id INTEGER PRIMARY KEY, type TEXT)");
        $this->pdo->exec("CREATE TABLE group_members (group_id INTEGER, user_id INTEGER)");
        $this->pdo->exec("CREATE TABLE migration_blob_id_map (
            entity_type TEXT, blob_id TEXT, rel_id INTEGER,
            PRIMARY KEY (entity_type, blob_id)
        )");
        // Quizzes
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
        // Time / Calendar / Report-Files
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
        // Phase-2-Schema dazu (learning_paths*)
        apply_phase2_schema($this->pdo);
    }

    private function seedUsers(): void
    {
        // Fixture referenziert user_id 1 und 2.
        $this->pdo->exec("INSERT INTO users (id, name, role) VALUES (1, 'Azubi A', 'azubi')");
        $this->pdo->exec("INSERT INTO users (id, name, role) VALUES (2, 'Ausbilder B', 'ausbilder')");
    }

    private function rowCount(string $table): int
    {
        return (int)$this->pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
    }

    // ─────────────────────────────────────────────────────────────
    //  Quizzes
    // ─────────────────────────────────────────────────────────────

    public function testMigrateQuizzesInsertsQuizQuestionsAndAnswers(): void
    {
        $stats = migrate_quizzes($this->pdo, $this->blob['quizzes']);
        // Fixture: 1 Quiz, 5 Fragen, 12 Antworten (4 Choice-Fragen × 3 + q_005 ist Text-Typ ohne answers)
        $this->assertSame(1, $stats['quizzes']);
        $this->assertSame(5, $stats['quiz_questions']);
        $this->assertSame(12, $stats['quiz_answers']);

        $this->assertSame(1, $this->rowCount('quizzes'));
        $this->assertSame(5, $this->rowCount('quiz_questions'));
        $this->assertSame(12, $this->rowCount('quiz_answers'));

        // Korrekte Antwort ist markiert
        $correct = (int)$this->pdo->query("SELECT COUNT(*) FROM quiz_answers WHERE is_correct=1")->fetchColumn();
        $this->assertSame(5, $correct, 'Fixture: 3 single-correct + 2 multiple-correct (q_003) = 5');

        // Difficulty wurde übernommen
        $diff = $this->pdo->query("SELECT difficulty FROM quizzes LIMIT 1")->fetchColumn();
        $this->assertSame('easy', $diff);
    }

    public function testMigrateQuizzesIsIdempotent(): void
    {
        migrate_quizzes($this->pdo, $this->blob['quizzes']);
        $stats2 = migrate_quizzes($this->pdo, $this->blob['quizzes']);
        $this->assertSame(0, $stats2['quizzes']);
        $this->assertSame(0, $stats2['quiz_questions']);
        $this->assertSame(0, $stats2['quiz_answers']);
        $this->assertSame(1, $this->rowCount('quizzes'));
        $this->assertSame(5, $this->rowCount('quiz_questions'));
        $this->assertSame(12, $this->rowCount('quiz_answers'));
    }

    public function testMigrateQuizzesSkipsWhenCreatorUnresolvable(): void
    {
        $bad = [['id' => 'q_x', 'title' => 'No-Creator', 'created_by' => 999, 'questions' => []]];
        $stats = migrate_quizzes($this->pdo, $bad);
        $this->assertSame(0, $stats['quizzes']);
        $this->assertSame(1, $stats['skipped']);
    }

    // ─────────────────────────────────────────────────────────────
    //  Learning Paths
    // ─────────────────────────────────────────────────────────────

    public function testMigrateLearningPathsInsertsAll(): void
    {
        $stats = migrate_learning_paths(
            $this->pdo,
            $this->blob['learningPaths'],
            $this->blob['pathProgress']
        );

        // Fixture:
        //   path_001: 4 Nodes, Edges aus prereq: node_002(1)+node_003(2)+node_004(1) = 4
        //   path_002: 3 Nodes, Edges: node_011(1)+node_012(1) = 2
        // Summe: 2 Paths, 7 Nodes, 6 Edges
        $this->assertSame(2, $stats['learning_paths']);
        $this->assertSame(7, $stats['learning_path_nodes']);
        $this->assertSame(6, $stats['learning_path_edges']);

        $this->assertSame(2, $this->rowCount('learning_paths'));
        $this->assertSame(7, $this->rowCount('learning_path_nodes'));
        $this->assertSame(6, $this->rowCount('learning_path_edges'));
    }

    public function testMigrateLearningPathProgressOnlyDoneStates(): void
    {
        migrate_learning_paths(
            $this->pdo,
            $this->blob['learningPaths'],
            $this->blob['pathProgress']
        );
        // Fixture "done"-States: path_001/node_001, path_001/node_002, path_002/node_010
        //   = 3 done-Nodes
        // Pro Node wird Progress für alle Azubi/Mentor/Ausbilder-User geschrieben (2 User).
        // Erwartet: 3 * 2 = 6 Progress-Rows.
        $this->assertSame(6, $this->rowCount('learning_path_progress'));
        // "in_progress" / "locked" sind NICHT enthalten.
        $allCompleted = (int)$this->pdo->query("SELECT COUNT(*) FROM learning_path_progress WHERE completed=1")->fetchColumn();
        $this->assertSame(6, $allCompleted);
    }

    public function testMigrateLearningPathsIsIdempotent(): void
    {
        migrate_learning_paths($this->pdo, $this->blob['learningPaths'], $this->blob['pathProgress']);
        $stats2 = migrate_learning_paths($this->pdo, $this->blob['learningPaths'], $this->blob['pathProgress']);
        $this->assertSame(0, $stats2['learning_paths']);
        $this->assertSame(0, $stats2['learning_path_nodes']);
        // Edges/Progress sind durch UNIQUE-Constraints idempotent
        $this->assertSame(0, $stats2['learning_path_edges']);
        $this->assertSame(0, $stats2['learning_path_progress']);
        $this->assertSame(2, $this->rowCount('learning_paths'));
        $this->assertSame(7, $this->rowCount('learning_path_nodes'));
        $this->assertSame(6, $this->rowCount('learning_path_edges'));
    }

    // ─────────────────────────────────────────────────────────────
    //  Calendar Events
    // ─────────────────────────────────────────────────────────────

    public function testMigrateCalendarEventsInsertsAll(): void
    {
        $stats = migrate_calendar_events($this->pdo, $this->blob['calendarEvents']);
        // Fixture: 3 Events, alle haben valid user_id (1 oder 2)
        $this->assertSame(3, $stats['calendar_events']);
        $this->assertSame(3, $this->rowCount('calendar_events'));

        $types = $this->pdo->query("SELECT type FROM calendar_events ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
        $this->assertSame(['event', 'deadline', 'holiday'], $types);
    }

    public function testMigrateCalendarEventsSkipsInvalidUser(): void
    {
        $bad = [['id' => 'ev_x', 'user_id' => 999, 'title' => 'X', 'event_date' => '2026-01-01']];
        $stats = migrate_calendar_events($this->pdo, $bad);
        $this->assertSame(0, $stats['calendar_events']);
        $this->assertSame(1, $stats['skipped']);
    }

    public function testMigrateCalendarEventsIsIdempotent(): void
    {
        migrate_calendar_events($this->pdo, $this->blob['calendarEvents']);
        $stats2 = migrate_calendar_events($this->pdo, $this->blob['calendarEvents']);
        $this->assertSame(0, $stats2['calendar_events']);
        $this->assertSame(3, $this->rowCount('calendar_events'));
    }

    // ─────────────────────────────────────────────────────────────
    //  Training Plan
    // ─────────────────────────────────────────────────────────────

    public function testMigrateTrainingPlanUpdatesAzubiUsers(): void
    {
        $stats = migrate_training_plan($this->pdo, $this->blob['trainingPlan']);
        // Fixture: 1 azubi-User
        $this->assertSame(1, $stats['training_plan_users']);
        $plan = $this->pdo->query("SELECT training_plan FROM users WHERE id=1")->fetchColumn();
        $this->assertNotNull($plan);
        $decoded = json_decode($plan, true);
        $this->assertIsArray($decoded);
        $this->assertSame('2026-06-15', $decoded['examDate']);
        $this->assertCount(5, $decoded['goals']);
    }

    public function testMigrateTrainingPlanIsIdempotent(): void
    {
        migrate_training_plan($this->pdo, $this->blob['trainingPlan']);
        $stats2 = migrate_training_plan($this->pdo, $this->blob['trainingPlan']);
        // Marker verhindert zweiten Update-Pass
        $this->assertSame(0, $stats2['training_plan_users']);
    }

    public function testMigrateTrainingPlanHandlesNull(): void
    {
        $stats = migrate_training_plan($this->pdo, null);
        $this->assertSame(0, $stats['training_plan_users']);
        $this->assertSame(1, $stats['skipped']);
    }

    // ─────────────────────────────────────────────────────────────
    //  Time Entries (per Task)
    // ─────────────────────────────────────────────────────────────

    public function testMigrateTimeEntriesForTaskInserts(): void
    {
        // Fixture task_001 hat 1 timeLog-Entry
        $task = $this->blob['projects'][0]['tasks'][0];
        $count = migrate_time_entries_for_task(
            $this->pdo,
            relTaskId: 100,
            relProjectId: 200,
            userId: 1,
            blobTaskId: $task['id'],
            timeLog: $task['timeLog']
        );
        $this->assertSame(1, $count);
        $this->assertSame(1, $this->rowCount('time_entries'));
    }

    public function testMigrateTimeEntriesIsIdempotent(): void
    {
        $task = $this->blob['projects'][0]['tasks'][0];
        migrate_time_entries_for_task($this->pdo, 100, 200, 1, $task['id'], $task['timeLog']);
        $c2 = migrate_time_entries_for_task($this->pdo, 100, 200, 1, $task['id'], $task['timeLog']);
        $this->assertSame(0, $c2);
        $this->assertSame(1, $this->rowCount('time_entries'));
    }

    public function testMigrateTimeEntriesSkipsWithoutUser(): void
    {
        $c = migrate_time_entries_for_task($this->pdo, 1, 1, null, 'task_x', [['start' => '2026-01-01T10:00:00Z']]);
        $this->assertSame(0, $c);
    }

    public function testMigrateTimeEntriesSkipsWithoutStart(): void
    {
        $c = migrate_time_entries_for_task($this->pdo, 1, 1, 1, 'task_x', [['end' => '2026-01-01T10:00:00Z']]);
        $this->assertSame(0, $c);
    }

    // ─────────────────────────────────────────────────────────────
    //  Report Files
    // ─────────────────────────────────────────────────────────────

    public function testMigrateReportFileObjectForm(): void
    {
        $report = $this->blob['reports'][0]; // rep_001 mit file als Objekt
        $c = migrate_report_file($this->pdo, 500, 1, $report['id'], $report['file']);
        $this->assertSame(1, $c);
        $this->assertSame(1, $this->rowCount('report_files'));
        $row = $this->pdo->query("SELECT * FROM report_files LIMIT 1")->fetch();
        $this->assertSame('rep_001.pdf', $row['filename']);
        $this->assertSame('/uploads/reports/rep_001.pdf', $row['file_path']);
        $this->assertSame(500, (int)$row['report_id']);
    }

    public function testMigrateReportFileStringForm(): void
    {
        $report = $this->blob['reports'][1]; // rep_002 mit file als String
        $c = migrate_report_file($this->pdo, 501, 1, $report['id'], $report['file']);
        $this->assertSame(1, $c);
        $row = $this->pdo->query("SELECT * FROM report_files LIMIT 1")->fetch();
        $this->assertSame('rep_002.pdf', $row['filename']);
    }

    public function testMigrateReportFileIsIdempotent(): void
    {
        $report = $this->blob['reports'][0];
        migrate_report_file($this->pdo, 500, 1, $report['id'], $report['file']);
        $c2 = migrate_report_file($this->pdo, 500, 1, $report['id'], $report['file']);
        $this->assertSame(0, $c2);
        $this->assertSame(1, $this->rowCount('report_files'));
    }

    public function testMigrateReportFileSkipsEmpty(): void
    {
        $this->assertSame(0, migrate_report_file($this->pdo, 500, 1, 'rep_x', null));
        $this->assertSame(0, migrate_report_file($this->pdo, 500, 1, 'rep_x', ''));
        $this->assertSame(0, migrate_report_file($this->pdo, 500, 1, 'rep_x', []));
    }
}
