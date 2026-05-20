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
}
