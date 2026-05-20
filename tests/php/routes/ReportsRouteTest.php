<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

#[CoversNothing]
final class ReportsRouteTest extends TestCase
{
    private string $code;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/api/routes/reports.php';
        $this->assertFileExists($path);
        $this->code = file_get_contents($path);
    }

    public function testRouteFileIsSyntacticallyValid(): void
    {
        $output = [];
        $exit = 0;
        exec(escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg(AZUBI_ROOT . '/api/routes/reports.php') . ' 2>&1', $output, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler:\n" . implode("\n", $output));
    }

    public function testRouteRequiresAuth(): void
    {
        $this->assertStringContainsString('require_auth()', $this->code);
    }

    public function testReportStatusEnumMatchesSchema(): void
    {
        // status enum('draft','submitted','reviewed','signed')
        foreach (['draft', 'submitted', 'reviewed', 'signed'] as $status) {
            $this->assertStringContainsString("'{$status}'", $this->code, "Status '$status' fehlt");
        }
    }

    public function testRouteEnforcesK2StatusRestriction(): void
    {
        // K2-Backend (Sprint 10): Azubi darf nur eigene Reports im Status 'draft' bearbeiten.
        // Mindestens eine der Prüfungen muss noch im Code stehen:
        //   - explizite Rollen-Differenzierung (ausbilder vs azubi)
        //   - draft-Restriktion
        $hasRoleCheck   = (bool)preg_match('/ausbilder|isAusbilder|role.*===?/', $this->code);
        $hasDraftCheck  = (bool)preg_match('/[\'"]draft[\'"]/', $this->code);
        $this->assertTrue($hasRoleCheck && $hasDraftCheck, 'K2-Status-Restriktion (Rolle + Status) muss in reports.php existieren');
    }

    public function testRouteHasUserOwnershipCheck(): void
    {
        // Eigene Reports vs fremde: user_id muss gegen $auth['sub'] / $uid geprüft werden
        // Akzeptiert Patterns wie `user_id !== $uid`, `(int)$r['user_id'] !== $uid`, `user_id === $auth['sub']`
        $this->assertMatchesRegularExpression(
            '/user_id[\'"]?\]?\s*[!=]==?\s*\$(uid|auth)/i',
            $this->code,
            'Ownership-Check (Vergleich user_id vs $uid/$auth) erwartet'
        );
    }
}
