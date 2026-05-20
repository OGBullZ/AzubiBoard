<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

#[CoversNothing]
final class FixtureTest extends TestCase
{
    private array $fixture;

    protected function setUp(): void
    {
        $path = AZUBI_ROOT . '/tests/fixtures/blob_realistic.json';
        $this->assertFileExists($path, 'Fixture muss existieren');
        $raw = file_get_contents($path);
        $this->fixture = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
    }

    public function testFixtureIsSchemaVersion5(): void
    {
        $this->assertSame(5, $this->fixture['schema_version']);
    }

    public function testFixtureHasAllRequiredTopLevelKeys(): void
    {
        $expected = [
            'schema_version', 'projects', 'reports', 'calendarEvents',
            'trash', 'trainingPlan', 'activityLog',
            'quizzes', 'learningPaths', 'pathProgress',
        ];
        foreach ($expected as $key) {
            $this->assertArrayHasKey($key, $this->fixture, "Top-level-Key '$key' fehlt");
        }
    }

    public function testFixtureProjectsCoverAllStatusEnums(): void
    {
        $statuses = array_column($this->fixture['projects'], 'status');
        $this->assertContains('green',  $statuses);
        $this->assertContains('yellow', $statuses);
        $this->assertContains('red',    $statuses);
    }

    public function testFixtureContainsArchivedProject(): void
    {
        $archived = array_filter($this->fixture['projects'], fn($p) => !empty($p['archived']));
        $this->assertNotEmpty($archived, 'Mindestens ein archiviertes Projekt erwartet (Migration-Edge-Case)');
    }

    public function testFixtureTasksCoverAllStatusEnums(): void
    {
        $allTasks = [];
        foreach ($this->fixture['projects'] as $p) {
            foreach ($p['tasks'] ?? [] as $t) {
                if (isset($t['status'])) $allTasks[] = $t['status'];
            }
        }
        foreach (['open', 'in_progress', 'done', 'blocked', 'waiting'] as $expected) {
            $this->assertContains($expected, $allTasks, "Task-Status '$expected' nicht in Fixture");
        }
    }

    public function testFixtureContainsTaskWithoutId(): void
    {
        // Migration-Edge-Case: v3-Migration generiert Fallback-ID
        $allTasks = array_merge(...array_map(fn($p) => $p['tasks'] ?? [], $this->fixture['projects']));
        $noId = array_filter($allTasks, fn($t) => !isset($t['id']));
        $this->assertNotEmpty($noId, 'Edge-Case "Task ohne ID" muss in Fixture vertreten sein');
    }

    public function testFixtureContainsInvalidDateForSafeDateCoverage(): void
    {
        // Edge-Case für safe_date-Logging (P0-6)
        $project = array_filter($this->fixture['projects'], fn($p) => ($p['start_date'] ?? '') === 'invalid-date-2026');
        $this->assertNotEmpty($project, 'Projekt mit ungültigem Datum für safe_date-Test erwartet');
    }

    public function testFixtureReportsCoverAllStatusEnums(): void
    {
        $statuses = array_column($this->fixture['reports'], 'status');
        foreach (['draft', 'submitted', 'reviewed', 'signed'] as $expected) {
            $this->assertContains($expected, $statuses, "Report-Status '$expected' nicht in Fixture");
        }
    }

    public function testFixtureHasReportsThatShouldBeSkippedByMigration(): void
    {
        // Migration soll skippen wenn: user_id null, user_id existiert nicht, week_start fehlt
        $reports = $this->fixture['reports'];
        $this->assertNotEmpty(array_filter($reports, fn($r) => ($r['user_id'] ?? null) === null), 'Report mit user_id=null erwartet');
        $this->assertNotEmpty(array_filter($reports, fn($r) => ($r['user_id'] ?? 0) === 999), 'Report mit nicht-existentem user_id erwartet');
        $this->assertNotEmpty(array_filter($reports, fn($r) => ($r['week_start'] ?? null) === null), 'Report ohne week_start erwartet');
    }

    public function testFixtureReportsHaveFileVariations(): void
    {
        // Migration soll Datei-URL aus Object ODER String extrahieren
        $reports = $this->fixture['reports'];
        $objectFile = array_filter($reports, fn($r) => is_array($r['file'] ?? null));
        $stringFile = array_filter($reports, fn($r) => is_string($r['file'] ?? null));
        $this->assertNotEmpty($objectFile, 'Report mit file als Object erwartet');
        $this->assertNotEmpty($stringFile, 'Report mit file als String erwartet');
    }

    public function testFixtureContainsBlobOnlyEntitiesForPhase2(): void
    {
        // Diese Entities werden von Phase 1 NICHT migriert — Phase 2 muss sie abdecken
        $this->assertNotEmpty($this->fixture['quizzes'],      'Quizzes-Lücke aus Cross-Check muss in Fixture vertreten sein');
        $this->assertNotEmpty($this->fixture['learningPaths'],'Lernpfade-Lücke aus Cross-Check muss in Fixture vertreten sein');
        $this->assertNotEmpty($this->fixture['pathProgress'], 'Path-Progress-Lücke aus Cross-Check muss in Fixture vertreten sein');
        $this->assertNotEmpty($this->fixture['calendarEvents'],'CalendarEvents-Lücke aus Cross-Check muss in Fixture vertreten sein');
    }

    public function testQuizFixtureHasQuestionsWithCorrectAnswers(): void
    {
        $quiz = $this->fixture['quizzes'][0];
        $this->assertGreaterThanOrEqual(5, count($quiz['questions']));
        // Erste Frage muss mindestens eine korrekte Antwort haben
        $correctCount = count(array_filter($quiz['questions'][0]['answers'], fn($a) => !empty($a['correct'])));
        $this->assertGreaterThan(0, $correctCount);
    }
}
