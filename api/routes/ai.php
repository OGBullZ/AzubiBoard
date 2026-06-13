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
} elseif ($action === 'review-report') {
    ai_review_report($user);
} elseif ($action === 'generate-quiz') {
    if (!in_array($user['role'], ['ausbilder', 'mentor'])) error('Keine Berechtigung', 403);
    ai_generate_quiz($user);
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

// ── AI4: KI-Feedback auf einen Wochenbericht (vor dem Einreichen) ──
function ai_review_report(array $user): never {
    if (!CLAUDE_API_KEY) {
        error('KI-Feature nicht konfiguriert. Bitte CLAUDE_API_KEY in .env setzen.', 503);
    }

    rate_limit('ai_review_' . $user['id'], 20, 3600); // 20 Calls/Stunde pro Nutzer

    $b = body();
    $title      = clean_str($b['title']      ?? '', 200,  false) ?? '';
    $activities = clean_str($b['activities'] ?? '', 4000, false) ?? '';
    $learnings  = clean_str($b['learnings']  ?? '', 2000, false) ?? '';
    $profession = clean_str($b['profession'] ?? '', 200,  false) ?? 'Auszubildende/r';
    $lehrjahr   = clean_int($b['lehrjahr']   ?? 1, 1, 3, 'lehrjahr');

    if (trim($activities) === '' && trim($learnings) === '') {
        error('Bericht ist leer — nichts zu prüfen.', 400);
    }

    $systemPrompt = 'Du bist ein wohlwollender Ausbilder, der Wochenberichte (IHK-Ausbildungsnachweis) prüft. '
        . 'Du gibst konkretes, umsetzbares Feedback, damit der Azubi den Bericht vor dem Einreichen verbessert. '
        . 'Du ersetzt NICHT die Prüfung durch den echten Ausbilder. '
        . 'Gib AUSSCHLIESSLICH valides JSON zurück – kein Markdown, kein Code-Block, keine Erklärung.';

    $userPrompt = "Prüfe diesen Wochenbericht eines Azubis (\"{$profession}\", {$lehrjahr}. Lehrjahr).\n\n"
        . ($title ? "Thema: {$title}\n\n" : '')
        . "Durchgeführte Tätigkeiten:\n{$activities}\n\n"
        . "Unterweisungen / Lerninhalte:\n{$learnings}\n\n"
        . "Gib 2-5 konkrete, freundliche Verbesserungs-Hinweise (Vollständigkeit, Konkretheit, Fachsprache, "
        . "fehlende Lerninhalte). Wenn der Bericht gut ist, sag das ehrlich (dann 1 positiver Hinweis).\n"
        . "Jeder Hinweis ist ein kurzer deutscher Satz.\n"
        . "Gib NUR dieses JSON zurück (nichts davor/danach):\n"
        . '{"suggestions":["...","..."]}';

    $rawText = claude_call_raw($userPrompt, $systemPrompt, 1024);
    if ($rawText === null) {
        error('KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.', 502);
    }

    $parsed = null;
    if (preg_match('/\{[\s\S]*"suggestions"[\s\S]*\}/m', $rawText, $m)) {
        $parsed = json_decode($m[0], true);
    }
    if (!is_array($parsed) || !isset($parsed['suggestions']) || !is_array($parsed['suggestions'])) {
        error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.', 502);
    }

    // Sanitisieren: max 5 Hinweise, je 300 Zeichen, leere raus.
    $suggestions = array_values(array_filter(array_map(
        fn($s) => mb_substr(trim((string)$s), 0, 300),
        array_slice($parsed['suggestions'], 0, 5)
    ), fn($s) => $s !== ''));

    respond(['suggestions' => $suggestions]);
}

// ── AI3: Quiz-Fragen aus einem Thema generieren (Prüfungsvorbereitung) ──
function ai_generate_quiz(array $user): never {
    if (!CLAUDE_API_KEY) {
        error('KI-Feature nicht konfiguriert. Bitte CLAUDE_API_KEY in .env setzen.', 503);
    }

    rate_limit('ai_quiz_' . $user['id'], 10, 3600); // 10 Calls/Stunde pro Nutzer

    $b = body();
    $topic      = clean_str($b['topic']      ?? '', 200, false) ?? '';
    $profession = clean_str($b['profession'] ?? '', 200, false) ?? 'Auszubildende/r';
    $count      = clean_int($b['count']      ?? 5, 1, 10, 'count');
    $difficulty = clean_str($b['difficulty'] ?? 'mittel', 20, false) ?? 'mittel';
    if (trim($topic) === '') error('Thema erforderlich', 400);

    $systemPrompt = 'Du bist Prüfungsexperte für die deutsche Berufsausbildung (IHK). '
        . 'Du erstellst faire Multiple-Choice-Prüfungsfragen mit genau einer korrekten Antwort. '
        . 'Gib AUSSCHLIESSLICH valides JSON zurück – kein Markdown, kein Code-Block, keine Erklärung.';

    $userPrompt = "Erstelle {$count} Multiple-Choice-Prüfungsfragen zum Thema \"{$topic}\" "
        . "für eine/n \"{$profession}\" (Schwierigkeit: {$difficulty}).\n\n"
        . "Anforderungen:\n"
        . "- Jede Frage hat genau 4 Antwortmöglichkeiten, GENAU EINE ist korrekt.\n"
        . "- Fachlich korrekt, prüfungsnah, deutsch.\n"
        . "- Kurze Erklärung zur richtigen Antwort.\n"
        . "Gib NUR dieses JSON zurück (nichts davor/danach):\n"
        . '{"questions":[{"question":"...","answers":[{"text":"...","correct":true},{"text":"...","correct":false},{"text":"...","correct":false},{"text":"...","correct":false}],"explanation":"..."}]}';

    $rawText = claude_call_raw($userPrompt, $systemPrompt, 3072);
    if ($rawText === null) {
        error('KI-Anfrage fehlgeschlagen. Bitte erneut versuchen.', 502);
    }

    $parsed = null;
    if (preg_match('/\{[\s\S]*"questions"[\s\S]*\}/m', $rawText, $m)) {
        $parsed = json_decode($m[0], true);
    }
    if (!is_array($parsed) || !isset($parsed['questions']) || !is_array($parsed['questions'])) {
        error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.', 502);
    }

    // Sanitisieren: max $count Fragen, je 2–4 nicht-leere Antworten, genau-eine-korrekt erzwungen.
    $questions = [];
    foreach (array_slice($parsed['questions'], 0, $count) as $q) {
        $text = mb_substr(trim((string)($q['question'] ?? '')), 0, 500);
        if ($text === '') continue;
        $answers = [];
        $correctSeen = false;
        foreach (array_slice((array)($q['answers'] ?? []), 0, 4) as $a) {
            $at = mb_substr(trim((string)($a['text'] ?? '')), 0, 300);
            if ($at === '') continue;
            $isCorrect = !empty($a['correct']) && !$correctSeen;
            if ($isCorrect) $correctSeen = true;
            $answers[] = ['text' => $at, 'correct' => $isCorrect];
        }
        if (count($answers) < 2) continue;
        if (!$correctSeen) $answers[0]['correct'] = true; // Fallback: erste Antwort korrekt
        $questions[] = [
            'question'    => $text,
            'answers'     => $answers,
            'explanation' => mb_substr(trim((string)($q['explanation'] ?? '')), 0, 500),
        ];
    }
    if (empty($questions)) error('Keine verwertbaren Fragen erzeugt. Bitte erneut versuchen.', 502);

    respond(['questions' => $questions]);
}
