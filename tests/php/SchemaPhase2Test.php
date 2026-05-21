<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Sprint 12 Phase 2 (P2-1b): Schema-Erweiterung verifizieren.
 *
 * Tests laufen gegen In-Memory-SQLite mit driver-portierter Variante
 * von apply_phase2_schema(). MariaDB-Pfad wird nicht hier getestet
 * (Statement-Verifikation passiert via SQL-File-Inhaltsprüfung).
 */
#[CoversNothing]
final class SchemaPhase2Test extends TestCase
{
    private static bool $helpersLoaded = false;
    private PDO $pdo;

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
        // Basis-Schema (das was azubiboard.sql in MariaDB liefert) — minimal nachgebaut.
        $this->pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT)");
        $this->pdo->exec("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)");
        $this->pdo->exec("CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER)");
        $this->pdo->exec("CREATE TABLE requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, title TEXT)");
    }

    private function tableExists(string $name): bool
    {
        $s = $this->pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
        $s->execute([$name]);
        return $s->fetch() !== false;
    }

    private function columnExists(string $table, string $column): bool
    {
        $s = $this->pdo->query("PRAGMA table_info($table)");
        foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $col) {
            if ($col['name'] === $column) return true;
        }
        return false;
    }

    // ── Tabellen-Anlage ──────────────────────────────────────────

    public function testApplyCreatesLearningPathTables(): void
    {
        apply_phase2_schema($this->pdo);
        $this->assertTrue($this->tableExists('learning_paths'));
        $this->assertTrue($this->tableExists('learning_path_nodes'));
        $this->assertTrue($this->tableExists('learning_path_edges'));
        $this->assertTrue($this->tableExists('learning_path_progress'));
    }

    public function testApplyAddsDeletedAtColumns(): void
    {
        apply_phase2_schema($this->pdo);
        $this->assertTrue($this->columnExists('projects', 'deleted_at'));
        $this->assertTrue($this->columnExists('reports', 'deleted_at'));
        $this->assertTrue($this->columnExists('requirements', 'deleted_at'));
    }

    public function testApplyAddsTrainingPlanToUsers(): void
    {
        apply_phase2_schema($this->pdo);
        $this->assertTrue($this->columnExists('users', 'training_plan'));
    }

    // ── Idempotenz ───────────────────────────────────────────────

    public function testApplyIsIdempotent(): void
    {
        apply_phase2_schema($this->pdo);
        // Zweiter Lauf darf nicht crashen
        $log = apply_phase2_schema($this->pdo);
        $this->assertIsArray($log);
        // Schema ist weiterhin intakt
        $this->assertTrue($this->tableExists('learning_paths'));
        $this->assertTrue($this->columnExists('users', 'training_plan'));
    }

    public function testApplyReturnsExecutionLog(): void
    {
        $log = apply_phase2_schema($this->pdo);
        $this->assertNotEmpty($log);
        // Mindestens die 4 Lernpfad-Tabellen + 3 deleted_at + 1 training_plan = 8 Schritte
        $this->assertGreaterThanOrEqual(8, count($log));
    }

    // ── Funktionale Verifikation (kann ich Daten einfügen?) ──────

    public function testCanInsertLearningPathAndNode(): void
    {
        apply_phase2_schema($this->pdo);
        $this->pdo->exec("INSERT INTO users (id, name) VALUES (1, 'Test')");
        $this->pdo->exec("INSERT INTO learning_paths (created_by, title, lehrjahr) VALUES (1, 'Pfad A', 1)");
        $pathId = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_nodes (path_id, title, type) VALUES ($pathId, 'Node A', 'article')");
        $nodeId = (int)$this->pdo->lastInsertId();

        $this->assertSame(1, (int)$this->pdo->query("SELECT COUNT(*) FROM learning_paths")->fetchColumn());
        $this->assertSame(1, (int)$this->pdo->query("SELECT COUNT(*) FROM learning_path_nodes WHERE path_id=$pathId")->fetchColumn());
        $this->assertGreaterThan(0, $nodeId);
    }

    public function testEdgeUniqueConstraintBlocksDuplicates(): void
    {
        apply_phase2_schema($this->pdo);
        $this->pdo->exec("INSERT INTO learning_paths (title) VALUES ('P')");
        $p = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_nodes (path_id, title) VALUES ($p, 'A')");
        $a = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_nodes (path_id, title) VALUES ($p, 'B')");
        $b = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_edges (path_id, from_node, to_node) VALUES ($p, $a, $b)");

        $this->expectException(\PDOException::class);
        $this->pdo->exec("INSERT INTO learning_path_edges (path_id, from_node, to_node) VALUES ($p, $a, $b)");
    }

    public function testProgressUniquePerUserNode(): void
    {
        apply_phase2_schema($this->pdo);
        $this->pdo->exec("INSERT INTO learning_paths (title) VALUES ('P')");
        $p = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_nodes (path_id, title) VALUES ($p, 'A')");
        $n = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO learning_path_progress (user_id, node_id, completed) VALUES (1, $n, 1)");

        $this->expectException(\PDOException::class);
        $this->pdo->exec("INSERT INTO learning_path_progress (user_id, node_id, completed) VALUES (1, $n, 0)");
    }

    // ── SQL-File-Inhalt (MariaDB-Source-of-truth) ────────────────

    public function testSqlFileContainsAllPhase2Statements(): void
    {
        $sql = file_get_contents(AZUBI_ROOT . '/database/migrations/sprint12_phase2.sql');
        $this->assertNotFalse($sql, 'sprint12_phase2.sql muss existieren');

        // Tabellen
        foreach (['learning_paths', 'learning_path_nodes', 'learning_path_edges', 'learning_path_progress'] as $t) {
            $this->assertStringContainsString("CREATE TABLE IF NOT EXISTS `$t`", $sql, "CREATE für $t fehlt");
        }
        // Soft-Delete-Spalten
        foreach (['projects', 'reports', 'requirements'] as $t) {
            $this->assertMatchesRegularExpression(
                "/ALTER TABLE `$t`\s+ADD COLUMN IF NOT EXISTS `deleted_at`/i",
                $sql,
                "deleted_at ALTER für $t fehlt"
            );
        }
        // training_plan
        $this->assertMatchesRegularExpression(
            '/ALTER TABLE `users`\s+ADD COLUMN IF NOT EXISTS `training_plan` JSON/i',
            $sql,
            'training_plan ALTER fehlt'
        );
    }
}
