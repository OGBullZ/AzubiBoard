<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * J2-Härtung (Tier-1-Fund 02.07.): POST /api/data OHNE If-Match-Header muss 409
 * liefern, sobald der Server bereits einen Blob hat — sonst überschreibt ein
 * frischer Client (nie GET /data gemacht, keine bekannte Version) den geteilten
 * Server-Blob mit seinem lokalen Seed (real passiert: Registrier-Flow nukte das
 * Projekt des Ausbilders). Stil wie DataGroupsGuardTest: statische Pattern-Prüfung.
 */
#[CoversNothing]
final class DataConflictGuardTest extends TestCase
{
    private string $code;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/api/routes/data.php';
        $this->assertFileExists($path);
        $this->code = file_get_contents($path);
    }

    public function testMissingIfMatchIsRejectedWhenServerHasData(): void
    {
        $guard = strpos($this->code, 'if ($ifMatch === null)');
        $this->assertNotFalse($guard,
            'No-If-Match-Guard fehlt — frischer Client könnte den Server-Blob blind überschreiben');

        // Der 409-Pfad muss INNERHALB des Guards liegen (vor dem nächsten Branch)
        $nextBranch = strpos($this->code, "if (\$ifMatch !== null && \$ifMatch !== '*')");
        $this->assertNotFalse($nextBranch, 'Versions-Vergleichs-Branch fehlt');
        $conflict = strpos($this->code, "'client_version'  => 0", $guard);
        $this->assertNotFalse($conflict, 'Guard antwortet nicht mit Conflict-Payload (client_version 0)');
        $this->assertLessThan($nextBranch, $conflict,
            'No-If-Match-409 muss VOR dem Versions-Vergleich stehen');
    }

    public function testFirstCreationOnEmptyServerStaysAllowed(): void
    {
        // Leerer app_data (serverVersion 0) darf weiter ohne Version angelegt werden,
        // sonst kommt ein frisch aufgesetzter Server nie an seinen ersten Blob.
        $guard = strpos($this->code, 'if ($ifMatch === null)');
        $versionCheck = strpos($this->code, 'if ($serverVersion > 0)', (int) $guard);
        $this->assertNotFalse($versionCheck,
            'Erst-Anlage-Ausnahme fehlt (409 darf nur bei vorhandenem Server-Blob greifen)');
    }

    public function testForceOverrideViaWildcardStaysPossible(): void
    {
        // Bewusster Override (forceSave nach Konflikt-Dialog) läuft über If-Match: * —
        // der Wildcard-Pfad muss den Versions-Vergleich weiterhin umgehen.
        $this->assertStringContainsString("\$ifMatch !== '*'", $this->code,
            'Wildcard-Override (If-Match: *) fehlt — Konflikt-Dialog könnte nie überschreiben');
    }
}
