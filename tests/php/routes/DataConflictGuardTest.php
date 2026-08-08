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
        // Seit Bug-Hunt 08-06 #3 entscheidet EIN Ausdruck über beide Fälle (fehlendes
        // If-Match und Versions-Abweichung), damit Prüfung und Schreibvorgang in
        // derselben Transaktion liegen können.
        $guard = strpos($this->code, '$versionMismatch = $ifMatch === null');
        $this->assertNotFalse($guard,
            'No-If-Match-Guard fehlt — frischer Client könnte den Server-Blob blind überschreiben');

        $conflict = strpos($this->code, "'error'           => 'Conflict'", $guard);
        $this->assertNotFalse($conflict, 'Guard antwortet nicht mit Conflict-Payload');

        $write = strpos($this->code, 'INSERT INTO app_data (id, content, version)');
        $this->assertNotFalse($write, 'Schreibvorgang nicht gefunden');
        $this->assertLessThan($write, $conflict, '409 muss VOR dem Schreibvorgang stehen');
    }

    public function testFirstCreationOnEmptyServerStaysAllowed(): void
    {
        // Leerer app_data (serverVersion 0) darf weiter ohne Version angelegt werden,
        // sonst kommt ein frisch aufgesetzter Server nie an seinen ersten Blob.
        $guard = strpos($this->code, '$versionMismatch = $ifMatch === null');
        $this->assertNotFalse($guard, 'Versions-Guard fehlt');
        $versionCheck = strpos($this->code, '$serverVersion > 0', (int) $guard);
        $this->assertNotFalse($versionCheck,
            'Erst-Anlage-Ausnahme fehlt (409 darf nur bei vorhandenem Server-Blob greifen)');
    }

    /**
     * Bug-Hunt 08-06 #3: Versionsprüfung und Schreibvorgang müssen in EINER
     * Transaktion mit Zeilensperre laufen. Ohne das lesen zwei überlappende POSTs
     * dieselbe Version, bestehen beide die If-Match-Prüfung und schreiben nacheinander
     * — kein 409, letzter gewinnt, die erste Änderung ist verloren.
     */
    public function testCheckAndWriteRunInOneLockedTransaction(): void
    {
        $begin = strpos($this->code, 'db()->beginTransaction()');
        $this->assertNotFalse($begin, 'Save läuft ohne Transaktion — TOCTOU zwischen Prüfung und Schreibvorgang');

        $lock = strpos($this->code, 'FROM app_data WHERE id = 1 FOR UPDATE', $begin);
        $this->assertNotFalse($lock, 'Zeilensperre (SELECT … FOR UPDATE) fehlt');

        $write  = strpos($this->code, 'INSERT INTO app_data (id, content, version)', $lock);
        $commit = strpos($this->code, 'db()->commit()', (int) $write);
        $this->assertNotFalse($write, 'Schreibvorgang liegt nicht innerhalb der Transaktion');
        $this->assertNotFalse($commit, 'Kein commit nach dem Schreibvorgang');
    }

    /**
     * Bug-Hunt 08-06 #2: Die Version war die Unix-SEKUNDE von updated_at. Zwei Saves
     * innerhalb derselben Sekunde ergaben dieselbe Version — der zweite Client bestand
     * die If-Match-Prüfung und überschrieb den ersten lautlos. Es muss ein echter
     * Zähler sein, der bei jedem Schreibvorgang steigt.
     */
    public function testVersionIsAMonotonicCounterNotASecondTimestamp(): void
    {
        $this->assertStringContainsString('version = version + 1', $this->code,
            'Versions-Zähler wird nicht hochgezählt — Sekunden-Auflösung lässt Lost Updates durch');
        $this->assertStringContainsString('function data_version_of', $this->code,
            'Versions-Helfer fehlt');
        // Kein roher strtotime(updated_at) mehr als Versionsquelle in den Antwortpfaden.
        // Erlaubt ist genau EIN Vorkommen: der Fallback in data_version_of() für alte
        // Installationen, deren version-Spalte noch fehlt.
        $this->assertSame(1, substr_count($this->code, "strtotime(\$row['updated_at'])"),
            'Version wird noch aus updated_at abgeleitet (Sekunden-Auflösung)');
        $helper = strpos($this->code, 'function data_version_of');
        $fallback = strpos($this->code, "strtotime(\$row['updated_at'])");
        $this->assertGreaterThan($helper, $fallback,
            'strtotime(updated_at) steht außerhalb von data_version_of — dort ist es die alte Sekunden-Version');
        $this->assertSame(0, substr_count($this->code, "strtotime(\$cur['updated_at'])"),
            'Version wird noch aus updated_at abgeleitet (Sekunden-Auflösung)');
    }

    public function testForceOverrideViaWildcardStaysPossible(): void
    {
        // Bewusster Override (forceSave nach Konflikt-Dialog) läuft über If-Match: * —
        // der Wildcard-Pfad muss den Versions-Vergleich weiterhin umgehen.
        $this->assertStringContainsString("\$ifMatch !== '*'", $this->code,
            'Wildcard-Override (If-Match: *) fehlt — Konflikt-Dialog könnte nie überschreiben');
    }
}
