<?php

declare(strict_types=1);

namespace AzubiBoard\Tests\Routes;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Bug-Hunt 08-06: Rechte-Lücken in den Schreibpfaden. Stil wie DataConflictGuardTest —
 * statische Pattern-Prüfung, weil die Routen ohne laufenden Webserver/MySQL nicht
 * end-to-end ausführbar sind. Jeder Test hält genau einen belegten Fund fest.
 */
#[CoversNothing]
final class PermissionGuardTest extends TestCase
{
    private function code(string $rel): string
    {
        $path = AZUBI_ROOT . '/' . $rel;
        $this->assertFileExists($path);
        return file_get_contents($path);
    }

    /**
     * Fund #6: Die Diff-Whitelist in validate_reports_diff kannte `days` (IHK-Tagesstruktur),
     * `signed_at`, `submitted_at` und `user_name` nicht. Wer NUR eines dieser Felder änderte,
     * erzeugte kein "changed" — damit lief die Owner-/Status-Prüfung gar nicht erst an und ein
     * Azubi konnte den Tagesbericht eines fremden, bereits signierten Nachweises umschreiben.
     */
    public function testReportDiffComparesEveryFieldNotAWhitelist(): void
    {
        $code = $this->code('api/routes/data.php');

        $this->assertStringNotContainsString("\$relevant = ['title','activities'", $code,
            'Report-Diff nutzt wieder eine Feld-Whitelist — nicht gelistete Felder umgehen die Owner-Prüfung');
        $this->assertStringContainsString('report_canon($or) === report_canon($nr)', $code,
            'Report-Diff vergleicht nicht mehr den vollständigen Datensatz');
        $this->assertStringContainsString('function report_canon', $code,
            'Kanonisierungs-Helfer für den Report-Diff fehlt');
    }

    /**
     * Fund #7: Die Mentor-Sperre (read-only Staff) listete `trash` und `activityLog` nicht,
     * obwohl beide reguläre Blob-Sektionen sind — ein Mentor konnte den Papierkorb leeren
     * und das Aktivitätsprotokoll löschen.
     */
    public function testMentorReadOnlyCoversTrashAndActivityLog(): void
    {
        $code = $this->code('api/routes/data.php');

        $start = strpos($code, "=== 'mentor'");
        $this->assertNotFalse($start, 'Mentor-Guard fehlt');
        $section = substr($code, $start, 400);

        foreach (['trash', 'activityLog', 'projects', 'calendarEvents'] as $sec) {
            $this->assertStringContainsString("'$sec'", $section,
                "Sektion '$sec' fehlt in der Mentor-Sperre — read-only Mentor kann sie überschreiben");
        }
    }

    /**
     * Fund #7 (zweiter Pfad): Endgültiges Löschen aus dem Papierkorb (purgeFromTrash) war
     * ausschließlich im UI hinter `isAusbilder` versteckt. Serverseitig konnte jede Rolle
     * per direktem POST fremde soft-gelöschte Berichte unwiderruflich entfernen.
     */
    public function testTrashPurgeIsGuardedServerSide(): void
    {
        $code = $this->code('api/routes/data.php');

        $this->assertStringContainsString('function validate_trash_diff', $code,
            'Kein Server-Guard für den Papierkorb — Purge ist reiner Client-Guard');
        $this->assertStringContainsString('validate_trash_diff($parsed[\'trash\']', $code,
            'validate_trash_diff wird im Save-Pfad nicht aufgerufen');
    }

    /**
     * Fund #8: GET /api/users und GET /api/users/{id} sind per with_group_filter_users
     * isoliert — PATCH/DELETE/activate liefen gegen ein blankes `WHERE id = ?`. Damit konnte
     * ein Ausbilder aus Gruppe A das Passwort jedes Nutzers setzen (IDs sind durchprobierbar).
     */
    public function testUserWritePathsAreGroupScoped(): void
    {
        $code = $this->code('api/routes/users.php');

        $this->assertStringContainsString('function require_user_in_scope', $code,
            'Scope-Prüfung für die Schreibpfade fehlt');
        $this->assertStringContainsString('with_group_filter_users', $code,
            'Scope-Prüfung nutzt nicht denselben Gruppenfilter wie die Lesepfade');

        // Jeder der drei Schreibpfade muss die Prüfung aufrufen
        $this->assertSame(3, substr_count($code, 'require_user_in_scope($id, $auth)'),
            'Nicht alle Schreibpfade (PATCH/DELETE/activate) sind gruppen-beschränkt');
    }

    /**
     * Fund #9: Alle By-ID-Pfade gehen durch project_visible (das für Ausbilder den
     * Gruppenfilter anlegt) — DELETE sprang für Ausbilder direkt ins UPDATE und konnte
     * damit ein Projekt aus einer fremden Gruppe archivieren.
     */
    public function testProjectDeleteChecksVisibility(): void
    {
        $code = $this->code('api/routes/projects.php');

        $delete = strpos($code, "if (\$method === 'DELETE' && \$id !== null)");
        $this->assertNotFalse($delete, 'DELETE-Pfad nicht gefunden');

        $update = strpos($code, 'UPDATE projects SET archived = 1 WHERE id = ?', $delete);
        $this->assertNotFalse($update, 'Archivier-UPDATE nicht gefunden');

        $visible = strpos($code, 'project_visible(db(), $id, $uid, $role)', $delete);
        $this->assertNotFalse($visible, 'DELETE prüft die Sichtbarkeit nicht');
        $this->assertLessThan($update, $visible,
            'Sichtbarkeitsprüfung muss VOR dem Archivieren stehen');
    }

    /**
     * Fund #12: `reviewer_comment` und `signed_file_url` sind Ausbilder-Felder, standen aber
     * für alle Rollen in $textFields. Ein Azubi konnte am eigenen Entwurf einen Kommentar
     * hinterlegen, den der Druck als "Kommentar des Ausbilders" ausgibt.
     */
    public function testReviewerFieldsAreInstructorOnly(): void
    {
        $code = $this->code('api/routes/reports.php');

        $this->assertStringNotContainsString(
            "\$textFields = ['title','activities','learnings','reviewer_comment'", $code,
            'reviewer_comment/signed_file_url sind wieder für alle Rollen schreibbar');
        $this->assertStringContainsString(
            "if (\$role === 'ausbilder') { \$textFields[] = 'reviewer_comment'; \$textFields[] = 'signed_file_url'; }",
            $code,
            'Ausbilder-Gate für reviewer_comment/signed_file_url fehlt');
    }

    /**
     * Fund #29: Die Liste filtert `is_public = 1`, der By-ID-Pfad lief gegen ein blankes
     * `WHERE id = ?`. Weil die IDs fortlaufende Integer sind, war jedes nicht-öffentliche
     * Quiz durchprobierbar — dieselbe Listen-/By-ID-Asymmetrie wie bei users und projects.
     */
    public function testQuizByIdRespectsVisibility(): void
    {
        $code = $this->code('api/routes/quizzes.php');

        $byId = strpos($code, "if (\$method === 'GET' && \$id !== null)");
        $this->assertNotFalse($byId, 'By-ID-Pfad nicht gefunden');

        $liste = strpos($code, "if (\$method === 'GET' && \$id === null)");
        $this->assertNotFalse($liste, 'Listen-Pfad nicht gefunden');

        // Der Sichtbarkeits-Check muss VOR der Antwort und innerhalb des By-ID-Blocks liegen
        $check = strpos($code, '$istOeffentlich', $byId);
        $this->assertNotFalse($check, 'By-ID-Pfad prüft die Sichtbarkeit nicht');
        $this->assertLessThan($liste, $check, 'Sichtbarkeitsprüfung liegt nicht im By-ID-Block');

        $this->assertStringContainsString('$istErsteller', $code,
            'Ersteller-Ausnahme fehlt — eigenes privates Quiz wäre nicht mehr abrufbar');
        // Nicht 403: das würde die Existenz der ID bestätigen
        $this->assertSame(2, substr_count($code, "error('Quiz nicht gefunden', 404)"),
            'Verdeckte Antwort (404) für unsichtbare Quizze fehlt');
    }

    /**
     * Fund #13: `LIMIT ?` wird bei ATTR_EMULATE_PREPARES=false als String gebunden; MySQL
     * wirft dann 1210 und der Fehler landete im catch — die Suche lieferte dauerhaft
     * 0 Treffer, ohne dass irgendwo etwas sichtbar wurde.
     */
    public function testSearchDoesNotBindLimitAsParameter(): void
    {
        $code = $this->code('api/routes/search.php');

        // Nur die SQL-Stellen zählen (der Erklär-Kommentar oben nennt `LIMIT ?` absichtlich)
        $this->assertSame(0, substr_count($code, 'DESC LIMIT ?'),
            'LIMIT wird wieder als Parameter gebunden — MySQL 1210, Suche liefert still 0 Treffer');
        $this->assertSame(0, substr_count($code, ', $limit]'),
            '$limit wird noch als execute-Parameter übergeben');
        $this->assertStringContainsString('LIMIT {$limit}', $code,
            'LIMIT wird nicht interpoliert');
        $this->assertStringContainsString('$limit = max(1, min((int)', $code,
            '$limit ist nicht int-gecastet/gedeckelt — Interpolation wäre unsicher bzw. LIMIT -n ungültig');
    }
}
