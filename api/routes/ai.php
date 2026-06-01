<?php
// ============================================================
//  AI2 (Sprint 14) — Claude-API: KI-Features
//  POST /api/ai/suggest-goals — Lernziel-Vorschläge generieren
// ============================================================

require_once __DIR__ . '/../ai_helpers.php';

$user   = require_role('ausbilder', 'mentor');
$action = $parts[1] ?? null;

if ($method !== 'POST') error('Method Not Allowed', 405);

if ($action === 'suggest-goals') {
    ai_suggest_goals($user);
} else {
    error("Unbekannte KI-Aktion '$action'", 404);
}

// ── Lernziel-Vorschläge ──────────────────────────────────────

function ai_suggest_goals(array $user): never {
    if (!CLAUDE_API_KEY) {
        error('KI-Feature nicht konfiguriert. Bitte CLAUDE_API_KEY in .env setzen.', 503);
    }

    rate_limit('ai_suggest_' . $user['id'], 20, 3600); // 20 Calls/Stunde pro Nutzer

    $b = body();

    $profession     = clean_str($b['profession'] ?? '', 200);
    $lehrjahr       = clean_int($b['lehrjahr']   ?? 1, 1, 3, 'lehrjahr');
    $context        = clean_str($b['context']    ?? '', 500, false) ?? '';
    $count          = clean_int($b['count']      ?? 6, 3, 10, 'count');
    $existingTitles = array_slice(
        array_map('strval', (array)($b['existingTitles'] ?? [])), 0, 30
    );

    $existingStr = !empty($existingTitles)
        ? "\n\nBereits vorhandene Lernziele (NICHT wiederholen):\n" . implode("\n", array_map(fn($t) => "- $t", $existingTitles))
        : '';

    $contextStr = $context ? "\n\nZusätzlicher Kontext: $context" : '';

    $systemPrompt = 'Du bist ein Experte für die duale Berufsausbildung in Deutschland (IHK/HWK). '
        . 'Du hilfst Ausbildern dabei, konkrete, praxisnahe Lernziele für ihre Azubis zu formulieren. '
        . 'Gib AUSSCHLIESSLICH ein valides JSON-Array zurück – keine Einleitung, keine Erklärung, kein Markdown, kein Code-Block.';

    $userPrompt = "Erstelle {$count} konkrete Lernziele für einen Azubi als \"{$profession}\" im {$lehrjahr}. Ausbildungsjahr.{$existingStr}{$contextStr}\n\n"
        . "Anforderungen:\n"
        . "- Konkret und messbar (keine Floskeln wie \"Kenntnisse erlangen\")\n"
        . "- Passend für den Ausbildungsstand im {$lehrjahr}. Lehrjahr\n"
        . "- Praktisch umsetzbar im Betrieb oder in der Schule\n"
        . "- Titel: maximal 60 Zeichen\n\n"
        . "Antwort als JSON-Array (NUR das Array, sonst nichts):\n"
        . "[\n"
        . "  {\n"
        . "    \"title\": \"Titel des Lernziels\",\n"
        . "    \"description\": \"Was der Azubi können oder wissen soll (1–2 Sätze).\",\n"
        . "    \"type\": \"task\"\n"
        . "  }\n"
        . "]\n\n"
        . "Erlaubte Typen: article (Theorie/Lesen), task (praktische Aufgabe), link (externe Ressource)";

    $suggestions = claude_call($userPrompt, $systemPrompt, 2048);

    if ($suggestions === null) {
        error('KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.', 502);
    }

    respond(['suggestions' => $suggestions]);
}

