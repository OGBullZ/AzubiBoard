<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PDO;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Sprint 12 L5-6a: Row-Level-Security via with_group_filter().
 *
 * Verifiziert Gruppen-Isolation (User aus Gruppe A sieht keine Daten aus B)
 * und die Nicht-Brechen-Garantie (ohne Gruppen-Mitgliedschaft keine Einschränkung).
 */
#[CoversNothing]
final class RlsTest extends TestCase
{
    private static bool $loaded = false;
    private PDO $pdo;

    public static function setUpBeforeClass(): void
    {
        if (!self::$loaded) {
            require_once AZUBI_ROOT . '/api/rls.php';
            self::$loaded = true;
        }
    }

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)");
        $this->pdo->exec("CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT)");
        $this->pdo->exec("CREATE TABLE group_members (group_id INTEGER, user_id INTEGER)");
        $this->pdo->exec("CREATE TABLE projects (id INTEGER PRIMARY KEY, group_id INTEGER, archived INTEGER DEFAULT 0, title TEXT)");

        // Gruppen A=1, B=2
        $this->pdo->exec("INSERT INTO groups (id,name) VALUES (1,'A'),(2,'B')");
        // user 1 (Ausbilder) in A, user 2 (Azubi) in A, user 4 (Azubi) in B, user 3 (Ausbilder) ohne Gruppe
        $this->pdo->exec("INSERT INTO users (id,name,role) VALUES
            (1,'AusbilderA','ausbilder'),(2,'AzubiA','azubi'),(3,'AusbilderFrei','ausbilder'),(4,'AzubiB','azubi')");
        $this->pdo->exec("INSERT INTO group_members (group_id,user_id) VALUES (1,1),(1,2),(2,4)");
        // Projekte: p1 in A, p2 in B, p3 ohne Gruppe (migriert)
        $this->pdo->exec("INSERT INTO projects (id,group_id,archived,title) VALUES
            (1,1,0,'A-Projekt'),(2,2,0,'B-Projekt'),(3,NULL,0,'Migriert-NULL')");
    }

    private function projectIds(array $user): array
    {
        $gf = with_group_filter($this->pdo, $user, 'group_id');
        $s = $this->pdo->prepare("SELECT id FROM projects WHERE archived = 0 AND {$gf['clause']} ORDER BY id");
        $s->execute($gf['params']);
        return array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN));
    }

    private function userIds(array $user): array
    {
        $gf = with_group_filter_users($this->pdo, $user, 'id');
        $s = $this->pdo->prepare("SELECT id FROM users WHERE {$gf['clause']} ORDER BY id");
        $s->execute($gf['params']);
        return array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN));
    }

    // ── Projekte ──────────────────────────────────────────────

    public function testUserGroupIds(): void
    {
        $this->assertSame([1], user_group_ids($this->pdo, 1));
        $this->assertSame([2], user_group_ids($this->pdo, 4));
        $this->assertSame([], user_group_ids($this->pdo, 3));
    }

    public function testAusbilderSeesOnlyOwnGroupProjectsPlusNull(): void
    {
        // user 1 (Gruppe A) → A-Projekt (1) + NULL-Projekt (3), NICHT B-Projekt (2)
        $this->assertSame([1, 3], $this->projectIds(['sub' => 1, 'role' => 'ausbilder']));
    }

    public function testGroupBUserDoesNotSeeGroupAProjects(): void
    {
        // user 4 (Gruppe B) → B-Projekt (2) + NULL (3), NICHT A-Projekt (1)
        $this->assertSame([2, 3], $this->projectIds(['sub' => 4, 'role' => 'azubi']));
    }

    public function testUserWithoutGroupSeesAllProjects(): void
    {
        // user 3 (keine Gruppe) → keine Einschränkung
        $this->assertSame([1, 2, 3], $this->projectIds(['sub' => 3, 'role' => 'ausbilder']));
        // Klausel ist explizit '1=1'
        $gf = with_group_filter($this->pdo, ['sub' => 3], 'group_id');
        $this->assertSame('1=1', $gf['clause']);
        $this->assertSame([], $gf['params']);
    }

    // ── Users ─────────────────────────────────────────────────

    public function testUsersListIsGroupScoped(): void
    {
        // user 1 (Gruppe A) → Mitglieder von A: user 1, 2 (+ self) — NICHT user 4 (Gruppe B)
        $this->assertSame([1, 2], $this->userIds(['sub' => 1, 'role' => 'ausbilder']));
    }

    public function testUsersListIncludesSelfEvenIfOnlyMember(): void
    {
        // user 4 (Gruppe B, einziges Mitglied) → nur sich selbst
        $this->assertSame([4], $this->userIds(['sub' => 4, 'role' => 'azubi']));
    }

    public function testUsersListUnrestrictedWithoutGroup(): void
    {
        // user 3 (keine Gruppe) → alle Nutzer
        $this->assertSame([1, 2, 3, 4], $this->userIds(['sub' => 3, 'role' => 'ausbilder']));
    }
}
