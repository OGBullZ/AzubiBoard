<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Statische Sicherheits-Tests für api/routes/projects.php.
 *
 * Voller HTTP-Integration-Test wäre erst ab dediziertem Test-Server möglich
 * (separater Task). Hier verifizieren wir, dass die kritischen Security-Patterns
 * im Source-Code vorhanden bleiben — regressions wie "jemand entfernt require_auth()"
 * würden hier sofort auffallen.
 */
#[CoversNothing]
final class ProjectsRouteTest extends TestCase
{
    private string $code;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/api/routes/projects.php';
        $this->assertFileExists($path);
        $this->code = file_get_contents($path);
    }

    public function testRouteFileIsSyntacticallyValid(): void
    {
        $output = [];
        $exit = 0;
        exec(escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg(AZUBI_ROOT . '/api/routes/projects.php') . ' 2>&1', $output, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler:\n" . implode("\n", $output));
    }

    public function testRouteRequiresAuth(): void
    {
        // Erste sicherheitsrelevante Zeile muss require_auth() aufrufen
        $this->assertStringContainsString('require_auth()', $this->code, 'require_auth() darf nicht entfernt werden — Routes wären öffentlich');
    }

    public function testRouteHasRowLevelSecurity(): void
    {
        $this->assertStringContainsString('function project_visible', $this->code, 'RLS-Helper project_visible() muss existieren');
        $this->assertStringContainsString('project_assignments', $this->code, 'RLS muss project_assignments-Tabelle nutzen');
    }

    public function testAusbilderIsGroupScopedNotFullBypass(): void
    {
        // L5-6a-Regression: project_visible() darf Ausbilder KEINEN bedingungslosen
        // Vollzugriff geben — sonst umgehen die By-ID-Pfade (GET/PATCH/Tasks) die
        // Gruppen-Isolation, die die Listen-Route korrekt anwendet (Cross-Gruppen-Leak).
        $this->assertDoesNotMatchRegularExpression(
            '/===?\s*[\'"]ausbilder[\'"]\s*\)\s*return\s+true/',
            $this->code,
            'project_visible() darf für Ausbilder nicht bedingungslos `return true` — Gruppen-Isolation würde umgangen'
        );
        // Stattdessen muss derselbe Gruppen-Filter wie in der Listen-Route greifen.
        $this->assertStringContainsString(
            'with_group_filter',
            $this->code,
            'project_visible() muss with_group_filter auch auf die By-ID-Pfade anwenden'
        );
    }

    public function testProjectStatusEnumMatchesSchema(): void
    {
        // ENUM muss synchron mit database/azubiboard.sql Z.201 sein:
        // status enum('green','yellow','red')
        foreach (['green', 'yellow', 'red'] as $status) {
            $this->assertStringContainsString("'{$status}'", $this->code, "Status-ENUM '$status' fehlt — driftet vom DB-Schema ab");
        }
    }

    public function testProjectPriorityEnumMatchesSchema(): void
    {
        // priority enum('low','medium','high','critical')
        foreach (['low', 'medium', 'high', 'critical'] as $prio) {
            $this->assertStringContainsString("'{$prio}'", $this->code, "Priority-ENUM '$prio' fehlt");
        }
    }

    public function testRouteHasSoftDeleteForArchive(): void
    {
        // DELETE soll archived=1 setzen (Soft-Delete), nicht hard DELETE
        $this->assertStringContainsString('archived', $this->code, 'Soft-Delete via archived-Flag erwartet');
    }
}
