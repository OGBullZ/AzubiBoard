<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Sprint 12 L5-6b: Audit-Log-Helper (audit_ensure_table, audit_log_write).
 *
 * Verifiziert, dass der Dual-Write pro Save eine Audit-Row schreiben kann und
 * dass der Helper fehlertolerant ist (kein Throw, wenn die Tabelle fehlt).
 */
#[CoversNothing]
final class AuditHelpersTest extends TestCase
{
    private static bool $loaded = false;
    private PDO $pdo;

    public static function setUpBeforeClass(): void
    {
        if (!self::$loaded) {
            require_once AZUBI_ROOT . '/api/audit_helpers.php';
            self::$loaded = true;
        }
    }

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    private function rowCount(): int
    {
        return (int)$this->pdo->query("SELECT COUNT(*) FROM audit_log")->fetchColumn();
    }

    public function testEnsureTableIsIdempotent(): void
    {
        audit_ensure_table($this->pdo);
        audit_ensure_table($this->pdo); // zweimal → kein Fehler
        $this->assertSame(0, $this->rowCount());
    }

    public function testWriteInsertsRowWithFields(): void
    {
        audit_ensure_table($this->pdo);
        $ok = audit_log_write($this->pdo, ['sub' => 7, 'name' => 'Tester', 'role' => 'ausbilder'], 'data.dual_write', [
            'entity_type' => 'data',
            'action'      => 'dual-write: 3 Datensätze relational angelegt',
            'meta'        => ['projects' => 2, 'reports' => 1],
        ]);
        $this->assertTrue($ok);
        $this->assertSame(1, $this->rowCount());

        $row = $this->pdo->query("SELECT * FROM audit_log LIMIT 1")->fetch();
        $this->assertSame(7, (int)$row['user_id']);
        $this->assertSame('Tester', $row['user_name']);
        $this->assertSame('ausbilder', $row['user_role']);
        $this->assertSame('data.dual_write', $row['type']);
        $this->assertSame('data', $row['entity_type']);
        // meta wurde als JSON serialisiert
        $meta = json_decode($row['meta'], true);
        $this->assertSame(2, $meta['projects']);
        $this->assertSame(1, $meta['reports']);
    }

    public function testWriteSimulatesDualWritePerSave(): void
    {
        // Modelliert die data.php-Logik: 1 Audit-Row pro Save, wenn etwas angelegt wurde.
        audit_ensure_table($this->pdo);
        $stats = ['projects' => 1, 'tasks' => 3, 'reports' => 0, 'skipped' => 5];
        $inserted = 0;
        foreach ($stats as $k => $v) { if ($k !== 'skipped') $inserted += $v; }
        $this->assertSame(4, $inserted);

        if ($inserted > 0) {
            audit_log_write($this->pdo, ['sub' => 1], 'data.dual_write', ['meta' => $stats]);
        }
        $this->assertSame(1, $this->rowCount());

        // Zweiter Save ohne neue Inserts (alles skipped) → keine zusätzliche Row.
        $stats2 = ['projects' => 0, 'tasks' => 0, 'reports' => 0, 'skipped' => 9];
        $inserted2 = 0;
        foreach ($stats2 as $k => $v) { if ($k !== 'skipped') $inserted2 += $v; }
        if ($inserted2 > 0) {
            audit_log_write($this->pdo, ['sub' => 1], 'data.dual_write', ['meta' => $stats2]);
        }
        $this->assertSame(1, $this->rowCount(), 'Save ohne neue Datensätze schreibt keine Audit-Row');
    }

    public function testWriteNeverThrowsWhenTableMissing(): void
    {
        // Keine Tabelle angelegt → Helper darf nicht werfen, nur false liefern.
        $ok = audit_log_write($this->pdo, ['sub' => 1], 'data.dual_write', []);
        $this->assertFalse($ok);
    }
}
