<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\CoversNothing;

/**
 * AI2 (Sprint 14) – Tests für Claude-API-Integration
 *
 * Testet:
 *  - Syntax-Validität von api/routes/ai.php und api/ai_helpers.php
 *  - CLAUDE_API_KEY-Konstante via config.php
 *  - _sanitize_suggestion() Hilfsfunktion (unit-testbar ohne HTTP-Request)
 *  - Route-Guards (require_role statt require_auth)
 *
 * Der echte Claude-API-Call wird NICHT ausgeführt (kein Key in CI).
 */
#[CoversNothing]
final class AiRouteTest extends TestCase
{
    private string $routeCode;
    private string $helpersCode;

    protected function setUp(): void
    {
        $this->routeCode   = file_get_contents(AZUBI_API . '/routes/ai.php');
        $this->helpersCode = file_get_contents(AZUBI_API . '/ai_helpers.php');
    }

    // ── Syntax ──────────────────────────────────────────────────

    public function testRouteSyntaxIsValid(): void
    {
        $out = []; $exit = 0;
        exec(PHP_BINARY . ' -l ' . escapeshellarg(AZUBI_API . '/routes/ai.php') . ' 2>&1', $out, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler in ai.php:\n" . implode("\n", $out));
    }

    public function testHelpersSyntaxIsValid(): void
    {
        $out = []; $exit = 0;
        exec(PHP_BINARY . ' -l ' . escapeshellarg(AZUBI_API . '/ai_helpers.php') . ' 2>&1', $out, $exit);
        $this->assertSame(0, $exit, "PHP-Syntax-Fehler in ai_helpers.php:\n" . implode("\n", $out));
    }

    // ── Route-Struktur ───────────────────────────────────────────

    public function testRouteRequiresAuth(): void
    {
        $this->assertStringContainsString('require_auth()', $this->routeCode,
            'ai.php muss require_auth() aufrufen');
    }

    public function testSuggestGoalsRestrictsToAusbilder(): void
    {
        $this->assertStringContainsString("'ausbilder', 'mentor'", $this->routeCode,
            'suggest-goals muss auf ausbilder + mentor beschränkt sein');
    }

    public function testFillReportActionExists(): void
    {
        $this->assertStringContainsString('fill-report', $this->routeCode,
            'ai.php muss fill-report Aktion enthalten');
        $this->assertStringContainsString('ai_fill_report', $this->routeCode,
            'ai_fill_report() Funktion muss vorhanden sein');
    }

    public function testReviewReportActionExists(): void
    {
        $this->assertStringContainsString('review-report', $this->routeCode,
            'ai.php muss review-report Aktion enthalten (AI4)');
        $this->assertStringContainsString('ai_review_report', $this->routeCode,
            'ai_review_report() Funktion muss vorhanden sein');
        $this->assertStringContainsString('rate_limit(', $this->routeCode,
            'ai_review_report muss rate_limit nutzen (Missbrauchsschutz)');
    }

    public function testGenerateQuizActionExists(): void
    {
        $this->assertStringContainsString('generate-quiz', $this->routeCode,
            'ai.php muss generate-quiz Aktion enthalten (AI3)');
        $this->assertStringContainsString('ai_generate_quiz', $this->routeCode,
            'ai_generate_quiz() Funktion muss vorhanden sein');
        $this->assertStringContainsString("in_array(\$user['role'], ['ausbilder', 'mentor'])", $this->routeCode,
            'generate-quiz muss auf Ausbilder/Mentor beschränkt sein');
    }

    public function testRouteRequiresHelpersFile(): void
    {
        $this->assertStringContainsString('ai_helpers.php', $this->routeCode,
            'ai.php muss ai_helpers.php einbinden');
    }

    public function testRouteChecksClaudeApiKey(): void
    {
        $this->assertStringContainsString('CLAUDE_API_KEY', $this->routeCode,
            'ai.php muss CLAUDE_API_KEY prüfen');
    }

    public function testRouteHas503ForMissingKey(): void
    {
        $this->assertStringContainsString('503', $this->routeCode,
            'ai.php muss 503 zurückgeben wenn CLAUDE_API_KEY fehlt');
    }

    public function testRouteHasRateLimiting(): void
    {
        $this->assertStringContainsString('rate_limit', $this->routeCode,
            'ai.php muss rate_limit() aufrufen');
    }

    // ── CLAUDE_API_KEY Konstante ─────────────────────────────────

    public function testClaudeApiKeyConstantDefined(): void
    {
        if (!defined('CLAUDE_API_KEY')) {
            require_once AZUBI_API . '/config.php';
        }
        $this->assertTrue(defined('CLAUDE_API_KEY'), 'CLAUDE_API_KEY muss in config.php definiert sein');
        $this->assertIsString(CLAUDE_API_KEY);
    }

    // ── _sanitize_suggestion (unit-testbar) ──────────────────────

    public static function setUpBeforeClass(): void
    {
        if (!defined('CLAUDE_API_KEY')) {
            require_once AZUBI_API . '/config.php';
        }
        require_once AZUBI_API . '/ai_helpers.php';
    }

    public function testSanitizeValidInput(): void
    {
        $result = _sanitize_suggestion([
            'title'       => 'Java Grundlagen',
            'description' => 'Variablen und Datentypen verstehen.',
            'type'        => 'article',
        ]);
        $this->assertNotNull($result);
        $this->assertSame('Java Grundlagen', $result['title']);
        $this->assertSame('article', $result['type']);
    }

    public function testSanitizeDefaultsToTask(): void
    {
        $result = _sanitize_suggestion(['title' => 'Test', 'type' => 'unknown']);
        $this->assertNotNull($result);
        $this->assertSame('task', $result['type']);
    }

    public function testSanitizeEmptyTitleReturnsNull(): void
    {
        $this->assertNull(_sanitize_suggestion(['title' => '   ']));
        $this->assertNull(_sanitize_suggestion(['title' => '']));
    }

    public function testSanitizeNonArrayReturnsNull(): void
    {
        $this->assertNull(_sanitize_suggestion(null));
        $this->assertNull(_sanitize_suggestion('string'));
        $this->assertNull(_sanitize_suggestion(42));
    }

    public function testSanitizeTitleTruncatedAt80(): void
    {
        $result = _sanitize_suggestion(['title' => str_repeat('A', 100)]);
        $this->assertSame(80, mb_strlen($result['title']));
    }

    public function testSanitizeDescriptionTruncatedAt400(): void
    {
        $result = _sanitize_suggestion(['title' => 'T', 'description' => str_repeat('X', 500)]);
        $this->assertSame(400, mb_strlen($result['description']));
    }

    public function testSanitizeAllValidTypes(): void
    {
        foreach (['article', 'link', 'task', 'quiz'] as $type) {
            $r = _sanitize_suggestion(['title' => 'T', 'type' => $type]);
            $this->assertSame($type, $r['type']);
        }
    }

    public function testSanitizeMissingDescriptionUsesEmpty(): void
    {
        $result = _sanitize_suggestion(['title' => 'Test']);
        $this->assertNotNull($result);
        $this->assertSame('', $result['description']);
    }
}
