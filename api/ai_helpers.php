<?php
// ============================================================
//  AI2 (Sprint 14) — Claude-API Helpers (unit-testbar)
//  Keine HTTP-Ausgabe, kein Auth-Check — reine Hilfsfunktionen.
// ============================================================

declare(strict_types=1);

/**
 * Ruft die Claude-API auf und gibt ein gepartes JSON-Array zurück.
 * Gibt null zurück wenn die API nicht erreichbar oder der Key fehlt.
 */
function claude_call(string $userPrompt, string $systemPrompt = '', int $maxTokens = 1024): ?array {
    if (!defined('CLAUDE_API_KEY') || CLAUDE_API_KEY === '') return null;

    $payload = json_encode([
        'model'      => 'claude-haiku-4-5-20251001',
        'max_tokens' => $maxTokens,
        'system'     => $systemPrompt,
        'messages'   => [['role' => 'user', 'content' => $userPrompt]],
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: '        . CLAUDE_API_KEY,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr || !$response || $httpCode !== 200) {
        error_log("[AI2] Claude API: HTTP $httpCode | curl: $curlErr | body: " . substr((string)$response, 0, 200));
        return null;
    }

    $data = json_decode($response, true);
    $text = $data['content'][0]['text'] ?? null;
    if (!is_string($text) || $text === '') return null;

    // Extrahiere JSON-Array (Claude könnte Markdown-Blöcke drumrum haben)
    if (preg_match('/\[[\s\S]*?\]/m', $text, $matches)) {
        $parsed = json_decode($matches[0], true);
        if (is_array($parsed)) {
            return array_values(array_filter(array_map('_sanitize_suggestion', $parsed)));
        }
    }

    return null;
}

/**
 * Bereinigt und validiert einen einzelnen KI-Vorschlag.
 * Gibt null zurück wenn title leer oder Input kein Array ist.
 */
function _sanitize_suggestion(mixed $s): ?array {
    if (!is_array($s)) return null;
    $title = trim((string)($s['title'] ?? ''));
    $desc  = trim((string)($s['description'] ?? ''));
    $type  = in_array($s['type'] ?? '', ['article', 'link', 'task', 'quiz']) ? $s['type'] : 'task';
    if ($title === '') return null;
    return [
        'title'       => mb_substr($title, 0, 80),
        'description' => mb_substr($desc,  0, 400),
        'type'        => $type,
    ];
}
