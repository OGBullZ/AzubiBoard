<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

#[CoversNothing]
final class GoalsRouteTest extends TestCase
{
    private string $code;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/api/routes/goals.php';
        $this->assertFileExists($path);
        $this->code = file_get_contents($path);
    }

    public function testRouteFileIsSyntacticallyValid(): void
    {
        $output = [];
        $exit = 0;
        exec(escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg(AZUBI_ROOT . '/api/routes/goals.php') . ' 2>&1', $output, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler:\n" . implode("\n", $output));
    }

    public function testRouteRequiresAuth(): void
    {
        $this->assertStringContainsString('require_auth()', $this->code);
    }

    public function testRequirementsPriorityEnumMatchesSchema(): void
    {
        // priority enum('must','should','could')
        foreach (['must', 'should', 'could'] as $prio) {
            $this->assertStringContainsString("'{$prio}'", $this->code, "Priority '$prio' fehlt");
        }
    }

    public function testRouteHandlesBothRequirementsAndMaterials(): void
    {
        // L5-4: goals.php deckt sowohl requirements als auch materials ab
        $this->assertStringContainsString('requirements', $this->code, 'goals.php muss requirements-Tabelle adressieren');
        $this->assertStringContainsString('materials',    $this->code, 'goals.php muss materials-Tabelle adressieren');
    }

    public function testAusbilderIsGroupScopedNotFullBypass(): void
    {
        // Bug-Hunt 5: goals_project_access() gab Ausbildern bedingungslos `return true`
        // → Cross-Gruppen-Leck auf requirements/materials fremder Projekte (anders als
        // project_visible() in projects.php). Muss denselben Gruppen-Filter anwenden.
        $this->assertDoesNotMatchRegularExpression(
            '/===?\s*[\'"]ausbilder[\'"]\s*\)\s*return\s+true/',
            $this->code,
            'goals_project_access() darf für Ausbilder nicht bedingungslos `return true` — Gruppen-Isolation würde umgangen'
        );
        $this->assertStringContainsString(
            'with_group_filter',
            $this->code,
            'goals_project_access() muss with_group_filter auf projects.group_id anwenden'
        );
    }
}
