<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * GR-F1 (Bug-Hunt 2): POST /api/data muss Gruppen-Mutationen von Nicht-Ausbildern
 * ablehnen — sonst kann sich ein Azubi per Raw-POST selbst in group.members heben
 * und damit die RLS-Gruppenisolation (with_group_filter) umgehen.
 * Stil wie ReportsRouteTest: statische Pattern-Prüfung + Syntax-Check.
 */
#[CoversNothing]
final class DataGroupsGuardTest extends TestCase
{
    private string $code;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/api/routes/data.php';
        $this->assertFileExists($path);
        $this->code = file_get_contents($path);
    }

    public function testRouteFileIsSyntacticallyValid(): void
    {
        $output = [];
        $exit = 0;
        exec(escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg(AZUBI_ROOT . '/api/routes/data.php') . ' 2>&1', $output, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler:\n" . implode("\n", $output));
    }

    public function testGroupsDiffGuardExistsAndIsWiredIntoNonAusbilderBranch(): void
    {
        $this->assertStringContainsString('function validate_groups_diff', $this->code,
            'validate_groups_diff fehlt — Gruppen-Mutationen wären serverseitig ungeprüft');
        // Aufruf muss im selben Nicht-Ausbilder-Block stehen wie validate_reports_diff
        $guardBlock = strpos($this->code, "!== 'ausbilder'");
        $call = strpos($this->code, 'validate_groups_diff($parsed');
        $this->assertNotFalse($guardBlock, 'Nicht-Ausbilder-Branch fehlt');
        $this->assertNotFalse($call, 'validate_groups_diff wird nicht aufgerufen');
        $this->assertGreaterThan($guardBlock, $call, 'Guard muss NACH der Rollen-Prüfung laufen');
    }

    public function testGuardRejectsTheRelevantMutationClasses(): void
    {
        // Jede Verbotsklasse muss als eigener 403-Pfad existieren — fehlt eine,
        // ist genau diese Mutation wieder still erlaubt.
        foreach ([
            'Gruppen anlegen/löschen ist Ausbilder-Sache',
            'Gruppen-Stammdaten geändert',
            'Gruppen-Mitglieder dürfen nur Ausbilder ändern',
            'fremde Beitritts-Anfragen geändert',
        ] as $msg) {
            $this->assertStringContainsString($msg, $this->code, "403-Pfad fehlt: $msg");
        }
        // Eigene Anfrage muss erlaubt bleiben: Differenz wird gegen die eigene UID geprüft
        $this->assertStringContainsString('$rid !== $uid', $this->code,
            'Eigene Beitritts-Anfrage muss erlaubt bleiben (Vergleich gegen eigene UID fehlt)');
    }

    public function testIdComparisonIsTypeTolerant(): void
    {
        // localStorage-Modus speichert String-IDs, API-Modus Integer — der Guard
        // muss normalisieren, sonst false-positives/-negatives je Modus.
        $this->assertStringContainsString('(string)$v', $this->code,
            'ID-Normalisierung (String-Cast) im Gruppen-Guard fehlt');
    }
}
