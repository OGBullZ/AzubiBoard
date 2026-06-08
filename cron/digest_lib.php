<?php
// ============================================================
//  digest_lib.php — N1 / Sprint 10 M3
//
//  Reine, seiteneffektfreie Helfer für den Wochen-Digest
//  (aus weekly_digest.php extrahiert → ohne DB/MTA unit-testbar).
//  Keine I/O, keine globalen Konstanten, keine env()-Zugriffe:
//  alle Eingaben werden als Argumente übergeben.
// ============================================================

declare(strict_types=1);

/** Eingereichte Berichte (status = 'submitted'). */
function digest_submitted_reports(array $reports): array {
    return array_values(array_filter($reports, fn($r) => ($r['status'] ?? '') === 'submitted'));
}

/**
 * Offene, überfällige Tasks aus allen Projekten sammeln.
 * Überspringt erledigte Tasks (status 'done' oder done-Flag) und Tasks ohne Deadline.
 * @param int $today Unix-Timestamp von "heute 00:00" (strtotime('today')).
 */
function digest_overdue_tasks(array $projects, int $today): array {
    $overdue = [];
    foreach ($projects as $p) {
        foreach ($p['tasks'] ?? [] as $t) {
            $dl = $t['deadline'] ?? null;
            if (!$dl) continue;
            if (($t['status'] ?? '') === 'done' || !empty($t['done'])) continue;
            if (strtotime($dl) < $today) {
                $overdue[] = ['project' => $p['title'] ?? '?', 'task' => $t['text'] ?? '?', 'deadline' => $dl];
            }
        }
    }
    return $overdue;
}

/** Betreff aus den Zählern — bei 0 offenen Punkten freundlicher "grüner Bereich". */
function digest_subject(int $reports, int $tasks, int $inactive): string {
    $bits = [];
    if ($reports > 0)  $bits[] = "$reports Berichte zu prüfen";
    if ($tasks > 0)    $bits[] = "$tasks überfällige Aufgaben";
    if ($inactive > 0) $bits[] = "$inactive inaktive Azubis";
    return 'AzubiBoard Wochenrückblick' . (empty($bits) ? ' — alles im grünen Bereich' : ': ' . implode(', ', $bits));
}

/**
 * Klartext-Body des Digests. Sektionen erscheinen nur wenn nicht leer.
 * @param string $appUrl Direktlink zur App (vom Aufrufer aus env('APP_URL') gereicht).
 */
function digest_body(array $recipient, array $reports, array $tasks, array $inactive, string $appUrl): string {
    $name = $recipient['name'] ?? 'Ausbilder';
    $out  = "Hallo $name,\n\nhier ist dein wöchentlicher AzubiBoard-Rückblick.\n\n";

    if (!empty($reports)) {
        $out .= "── Berichte zur Prüfung (" . count($reports) . ") ──\n";
        foreach (array_slice($reports, 0, 10) as $r) {
            $kw  = $r['week_number'] ?? '?';
            $yr  = $r['year']        ?? '?';
            $who = $r['user_name']   ?? 'Azubi';
            $out .= " · KW $kw/$yr — $who\n";
        }
        if (count($reports) > 10) $out .= " · … und " . (count($reports) - 10) . " weitere\n";
        $out .= "\n";
    }

    if (!empty($tasks)) {
        $out .= "── Überfällige Aufgaben (" . count($tasks) . ") ──\n";
        foreach (array_slice($tasks, 0, 10) as $t) {
            $out .= " · [{$t['project']}] {$t['task']} — fällig {$t['deadline']}\n";
        }
        if (count($tasks) > 10) $out .= " · … und " . (count($tasks) - 10) . " weitere\n";
        $out .= "\n";
    }

    if (!empty($inactive)) {
        $out .= "── Azubis ohne Aktivität ≥ 7 Tage (" . count($inactive) . ") ──\n";
        foreach ($inactive as $a) {
            $last = $a['last_login'] ? "zuletzt {$a['last_login']}" : 'nie eingeloggt';
            $out .= " · {$a['name']} ($last)\n";
        }
        $out .= "\n";
    }

    if (empty($reports) && empty($tasks) && empty($inactive)) {
        $out .= "Alles im grünen Bereich — keine offenen Punkte.\n\n";
    }

    $out .= "Direkt zur App: " . $appUrl . "\n";
    $out .= "\nDeaktivieren: Profil → Benachrichtigungen ausschalten\n";
    return $out;
}
