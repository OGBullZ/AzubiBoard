<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use RuntimeException;

#[CoversNothing]
final class MigrationHelpersTest extends TestCase
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
        // SQLite in-memory: schnelle, isolierte Tests ohne MySQL-Setup
        $this->pdo = new PDO('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Minimales Schema das die getesteten Helpers brauchen
        $this->pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT)");
        $this->pdo->exec("CREATE TABLE groups (id INTEGER PRIMARY KEY, type TEXT)");
        $this->pdo->exec("CREATE TABLE group_members (group_id INTEGER, user_id INTEGER)");
        $this->pdo->exec("CREATE TABLE migration_blob_id_map (entity_type TEXT, blob_id TEXT, rel_id INTEGER, PRIMARY KEY (entity_type, blob_id))");
    }

    // ── safe_date ─────────────────────────────────────────────

    public function testSafeDateWithValidIsoInputReturnsYmd(): void
    {
        $this->assertSame('2026-01-15', safe_date('2026-01-15'));
        $this->assertSame('2026-01-15', safe_date('2026-01-15T10:30:00Z'));
        $this->assertSame('2026-05-20', safe_date('May 20, 2026'));
    }

    public function testSafeDateReturnsNullOnEmptyInput(): void
    {
        $this->assertNull(safe_date(null));
        $this->assertNull(safe_date(''));
    }

    public function testSafeDateReturnsNullOnInvalidInput(): void
    {
        // P0-6: invalid input wird zu null + error_log (kein silent drop mehr)
        $this->assertNull(safe_date('not-a-date'));
        $this->assertNull(safe_date('invalid-date-2026'));
    }

    public function testSafeDateLogsContextOnDrop(): void
    {
        // error_log schreibt nach php.ini error_log oder syslog. Hier
        // checken wir lediglich dass die Funktion nicht crasht UND null liefert.
        // (Eigentlicher Log-Pfad ist umgebungs-abhängig.)
        $this->assertNull(safe_date('garbage', 'test:context'));
    }

    // ── safe_ts ───────────────────────────────────────────────

    public function testSafeTsWithValidInputReturnsYmdHis(): void
    {
        // TZ-agnostisch — strtotime+date nutzen die lokale TZ, also nur Format prüfen
        $result = safe_ts('2026-01-15T10:30:00Z');
        $this->assertMatchesRegularExpression('/^2026-01-15 \d{2}:\d{2}:00$/', $result);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', safe_ts('2026-05-20 14:00:00'));
    }

    public function testSafeTsReturnsNullOnInvalidInput(): void
    {
        $this->assertNull(safe_ts(null));
        $this->assertNull(safe_ts(''));
        $this->assertNull(safe_ts('totally-not-a-timestamp'));
    }

    // ── migration_status_or_default ───────────────────────────

    public function testStatusOrDefaultReturnsValidEnum(): void
    {
        $this->assertSame('green',  migration_status_or_default('green',  ['green','yellow','red'], 'yellow'));
        $this->assertSame('red',    migration_status_or_default('red',    ['green','yellow','red'], 'yellow'));
        $this->assertSame('must',   migration_status_or_default('must',   ['must','should','could'], 'must'));
    }

    public function testStatusOrDefaultFallsBackOnInvalidValue(): void
    {
        $this->assertSame('yellow', migration_status_or_default('blau',     ['green','yellow','red'], 'yellow'));
        $this->assertSame('medium', migration_status_or_default('critical', ['low','medium','high'], 'medium'));
    }

    public function testStatusOrDefaultHandlesNullAndEmpty(): void
    {
        $this->assertSame('yellow', migration_status_or_default(null, ['green','yellow','red'], 'yellow'));
        $this->assertSame('yellow', migration_status_or_default('',   ['green','yellow','red'], 'yellow'));
    }

    // ── resolve_user ──────────────────────────────────────────

    public function testResolveUserReturnsIntWhenUserExists(): void
    {
        $this->pdo->exec("INSERT INTO users (id, role) VALUES (1, 'azubi'), (2, 'ausbilder')");
        $this->assertSame(1, resolve_user($this->pdo, 1));
        $this->assertSame(2, resolve_user($this->pdo, '2'));
    }

    public function testResolveUserReturnsNullForNonexistentId(): void
    {
        $this->pdo->exec("INSERT INTO users (id, role) VALUES (1, 'azubi')");
        $this->assertNull(resolve_user($this->pdo, 999));
    }

    public function testResolveUserReturnsNullForInvalidInput(): void
    {
        $this->assertNull(resolve_user($this->pdo, null));
        $this->assertNull(resolve_user($this->pdo, 0));
        $this->assertNull(resolve_user($this->pdo, -1));
        $this->assertNull(resolve_user($this->pdo, 'not-an-id'));
    }

    // ── resolve_group_for_user (P0-6 Fix) ─────────────────────

    public function testResolveGroupForUserReturnsNullWithoutUser(): void
    {
        $this->assertNull(resolve_group_for_user($this->pdo, null));
        $this->assertNull(resolve_group_for_user($this->pdo, 0));
    }

    public function testResolveGroupForUserReturnsLerngruppeFirst(): void
    {
        $this->pdo->exec("INSERT INTO users (id, role) VALUES (1, 'azubi')");
        $this->pdo->exec("INSERT INTO groups (id, type) VALUES (10, 'team'), (20, 'lerngruppe')");
        $this->pdo->exec("INSERT INTO group_members (group_id, user_id) VALUES (10, 1), (20, 1)");
        // P0-6 erwartet: Lerngruppe wird vor Team gewählt
        $this->assertSame(20, resolve_group_for_user($this->pdo, 1));
    }

    public function testResolveGroupForUserReturnsNullIfNoMembership(): void
    {
        $this->pdo->exec("INSERT INTO users (id, role) VALUES (1, 'azubi')");
        $this->assertNull(resolve_group_for_user($this->pdo, 1));
    }

    // ── mapped_id / register_map (Idempotenz) ─────────────────

    public function testMappedIdReturnsNullForUnknownEntity(): void
    {
        $this->assertNull(mapped_id($this->pdo, 'project', 'proj_unknown'));
    }

    public function testMappedIdReturnsRelIdAfterInsert(): void
    {
        $this->pdo->exec("INSERT INTO migration_blob_id_map (entity_type, blob_id, rel_id) VALUES ('project', 'proj_abc', 42)");
        $this->assertSame(42, mapped_id($this->pdo, 'project', 'proj_abc'));
    }

    // ── migration_check_required_tables (Pre-Flight, P0-6) ────

    public function testCheckRequiredTablesPassesWhenAllExist(): void
    {
        // Schema-Setup hat users/groups/group_members/migration_blob_id_map angelegt
        $this->expectNotToPerformAssertions();
        migration_check_required_tables($this->pdo, ['users', 'groups']);
    }

    public function testCheckRequiredTablesThrowsWhenMissing(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Tabelle .projects. existiert nicht/');
        migration_check_required_tables($this->pdo, ['users', 'projects']);
    }
}
