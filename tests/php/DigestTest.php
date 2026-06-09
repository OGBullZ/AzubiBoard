<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * N1 / Sprint 10 M3 — reine Digest-Helfer (cron/digest_lib.php).
 *
 * Testet die seiteneffektfreie Inhalts-Logik des Wochen-Digests ohne DB/MTA:
 * Metrik-Berechnung, Betreff-Wortlaut und Body-Sektionen. Der eigentliche
 * SMTP-Versand (api/mailer.php) ist [Server]-verifizierbar und hier bewusst
 * nicht abgedeckt — diese Tests sichern die Daten→Text-Verdichtung.
 */
#[CoversNothing]
final class DigestTest extends TestCase
{
    private static bool $loaded = false;

    protected function setUp(): void
    {
        if (!self::$loaded) {
            require_once AZUBI_ROOT . '/cron/digest_lib.php';
            self::$loaded = true;
        }
    }

    public function testSubmittedReportsFiltertNurEingereichte(): void
    {
        $reports = [
            ['id' => 1, 'status' => 'submitted'],
            ['id' => 2, 'status' => 'draft'],
            ['id' => 3, 'status' => 'signed'],
            ['id' => 4, 'status' => 'submitted'],
            ['id' => 5],                          // status fehlt → nicht eingereicht
        ];
        $out = digest_submitted_reports($reports);
        $this->assertCount(2, $out);
        $this->assertSame([1, 4], array_column($out, 'id'));
    }

    public function testOverdueTasksUeberspringtErledigteUndDeadlinelose(): void
    {
        $today = strtotime('today');
        $past   = date('Y-m-d', $today - 5 * 86400);
        $future = date('Y-m-d', $today + 5 * 86400);
        $projects = [[
            'title' => 'Doku',
            'tasks' => [
                ['text' => 'überfällig-offen',  'deadline' => $past,   'status' => 'open'],
                ['text' => 'überfällig-erledigt','deadline' => $past,   'status' => 'done'],   // skip: done
                ['text' => 'überfällig-doneflag','deadline' => $past,   'done' => true],         // skip: done-Flag
                ['text' => 'ohne-deadline',      'status' => 'open'],                            // skip: keine Deadline
                ['text' => 'zukunft',            'deadline' => $future, 'status' => 'open'],      // skip: nicht überfällig
                ['text' => 'kaputtes-datum',     'deadline' => 'unbekannt', 'status' => 'open'],  // skip: strtotime=false (#14)
            ],
        ]];
        $out = digest_overdue_tasks($projects, $today);
        $this->assertCount(1, $out);
        $this->assertSame('überfällig-offen', $out[0]['task']);
        $this->assertSame('Doku', $out[0]['project']);
    }

    public function testOverdueIgnoriertUnparsbaresDatum(): void
    {
        // #14: strtotime('unbekannt') === false, früher false<today → fälschlich überfällig.
        $today    = strtotime('today');
        $projects = [['title' => 'X', 'tasks' => [
            ['text' => 'kaputt', 'deadline' => 'unbekannt', 'status' => 'open'],
            ['text' => 'leer',   'deadline' => 'not-a-date', 'status' => 'open'],
        ]]];
        $this->assertCount(0, digest_overdue_tasks($projects, $today));
    }

    public function testSubjectSpiegeltZaehlerWider(): void
    {
        $this->assertSame(
            'AzubiBoard Wochenrückblick: 3 Berichte zu prüfen, 2 überfällige Aufgaben, 1 inaktive Azubis',
            digest_subject(3, 2, 1)
        );
    }

    public function testSubjectBeiNullPunktenGruenerBereich(): void
    {
        $this->assertSame('AzubiBoard Wochenrückblick — alles im grünen Bereich', digest_subject(0, 0, 0));
    }

    public function testBodyZeigtSektionenNurWennGefuellt(): void
    {
        $recipient = ['name' => 'Frau Berg'];
        $reports   = [['week_number' => 23, 'year' => 2026, 'user_name' => 'Tobias']];
        $tasks     = [['project' => 'Doku', 'task' => 'API', 'deadline' => '2026-06-01']];
        $body = digest_body($recipient, $reports, $tasks, [], 'https://app.example');

        $this->assertStringContainsString('Hallo Frau Berg,', $body);
        $this->assertStringContainsString('Berichte zur Prüfung (1)', $body);
        $this->assertStringContainsString('KW 23/2026 — Tobias', $body);
        $this->assertStringContainsString('Überfällige Aufgaben (1)', $body);
        $this->assertStringContainsString('[Doku] API', $body);
        $this->assertStringNotContainsString('ohne Aktivität', $body);          // leer → keine Sektion
        $this->assertStringContainsString('https://app.example', $body);
    }

    public function testBodyLeerstandZeigtGruenerBereich(): void
    {
        $body = digest_body(['name' => 'X'], [], [], [], 'https://app.example');
        $this->assertStringContainsString('Alles im grünen Bereich — keine offenen Punkte.', $body);
        $this->assertStringNotContainsString('Berichte zur Prüfung', $body);
    }

    public function testBodyKuerztLangeBerichtslisteAuf10(): void
    {
        $reports = array_map(fn($i) => ['week_number' => $i, 'year' => 2026, 'user_name' => "A$i"], range(1, 13));
        $body = digest_body(['name' => 'X'], $reports, [], [], 'https://app.example');
        $this->assertStringContainsString('Berichte zur Prüfung (13)', $body);
        $this->assertStringContainsString('… und 3 weitere', $body);
    }
}
