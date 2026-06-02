<?php
// ============================================================
//  AI2 (Sprint 14) — Claude-API: KI-Features
//  POST /api/ai/suggest-goals — Lernziel-Vorschläge generieren
// ============================================================

require_once __DIR__ . '/../ai_helpers.php';

$user   = require_auth();  // Feinere Rollentrennung pro Aktion
$action = $parts[1] ?? null;

if ($method !== 'POST') error('Method Not Allowed', 405);

if ($action === 'suggest-goals') {
    if (!in_array($user['role'], ['ausbilder', 'mentor'])) error('Keine Berechtigung', 403);
    ai_suggest_goals($user);
} elseif ($action === 'fill-report') {
    ai_fill_report($user);
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

// ── AI1: Tätigkeitsbericht aus Aufgaben generieren ───────────

function ai_fill_report(array $user): never {
    if (!CLAUDE_API_KEY) {
        error('KI-Feature nicht konfiguriert. Bitte CLAUDE_API_KEY in .env setzen.', 503);
    }

    rate_limit('ai_fillreport_' . $user['id'], 15, 3600); // 15 Calls/Stunde pro Nutzer

    $b = body();

    // taskGroups: [{ project: "...", tasks: ["...", "..."] }]
    $taskGroups = (array)($b['taskGroups'] ?? []);
    if (empty($taskGroups)) error('taskGroups erforderlich', 400);
    if (count($taskGroups) > 20) $taskGroups = array_slice($taskGroups, 0, 20);

    $weekNumber = clean_int($b['weekNumber'] ?? date('W'), 1, 53, 'weekNumber');
    $year       = clean_int($b['year']       ?? (int)date('Y'), 2020, 2100, 'year');
    $profession = clean_str($b['profession'] ?? '', 200, false) ?? 'Auszubildende/r';
    $lehrjahr   = clean_int($b['lehrjahr']   ?? 1, 1, 3, 'lehrjahr');

    // Aufgabenliste als Text aufbauen
    $taskLines = [];
    foreach ($taskGroups as $grp) {
        $proj  = mb_substr(trim((string)($grp['project'] ?? 'Projekt')), 0, 100);
        $tasks = array_slice(array_map(
            fn($t) => '  - ' . mb_substr(trim((string)$t), 0, 150),
            (array)($grp['tasks'] ?? [])
        ), 0, 20);
        if (!empty($tasks)) {
            $taskLines[] = "$proj:\n" . implode("\n", $tasks);
        }
    }

    if (empty($taskLines)) error('Keine verwertbaren Aufgaben', 400);

    $taskListStr = implode("\n\n", $taskLines);

    $systemPrompt = 'Du bist ein Experte für Ausbildungsberichtshefte in Deutschland (IHK-Standard). '
        . 'Du schreibst professionelle Tätigkeits- und Lernberichte für Auszubildende. '
        . 'Gib AUSSCHLIESSLICH valides JSON zurück – kein Markdown, kein Code-Block, keine Erklärung.';

    $userPrompt = "Schreibe einen professionellen Ausbildungsbericht (KW {$weekNumber}/{$year}) "
        . "für eine/n Auszubildende/n als \"{$profession}\" im {$lehrjahr}. Ausbildungsjahr.\n\n"
        . "Durchgeführte Aufgaben:\n{$taskListStr}\n\n"
        . "Anforderungen:\n"
        . "- Tätigkeitsbericht: 120-250 Wörter, Vergangenheitsform, IHK-gerechte Fachsprache\n"
        . "- Lernbericht: 60-120 Wörter, was wurde dabei gelernt/vertieft\n"
        . "- Natürlich formuliert, nicht wie eine Liste, sondern als Fließtext\n"
        . "- Berufsspezifische Fachbegriffe verwenden\n\n"
        . "Gib NUR dieses JSON zurück (keine anderen Zeichen davor oder danach):\n"
        . '{"activities":"...","learnings":"..."}';

    $rawText = claude_call_raw($userPrompt, $systemPrompt, 1536);

    if ($rawText === null) {
        error('KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.', 502);
    }

    // Extrahiere JSON-Objekt (Claude könnte Markdown-Blöcke drumrum haben)
    $parsed = null;
    if (preg_match('/\{[\s\S]*"activities"[\s\S]*"learnings"[\s\S]*\}/m', $rawText, $m)) {
        $parsed = json_decode($m[0], true);
    }
    if (!is_array($parsed) || empty($parsed['activities'])) {
        error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.', 502);
    }

    respond([
        'activities' => mb_substr(trim((string)($parsed['activities'] ?? '')), 0, 3000),
        'learnings'  => mb_substr(trim((string)($parsed['learnings']  ?? '')), 0, 1500),
    ]);
}
