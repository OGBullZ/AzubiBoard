<?php
// ============================================================
//  Sprint 10 M3 — Wöchentliche Ausbilder-Mail
//
//  Cron-Aufruf (Mo 07:00):
//    0 7 * * 1 php /var/www/azubiboard/cron/weekly_digest.php
//
//  Schickt jedem aktiven Ausbilder + Mentor (mit notifications_enabled=1)
//  eine Zusammenfassung der vergangenen Woche:
//    - Eingereichte Berichte zur Prüfung
//    - Überfällige Tasks
//    - Azubis ohne Aktivität ≥ 7 Tage
//
//  SMTP-Konfig: nutzt PHP-native mail() — auf einem Linux-Server
//  mit konfiguriertem Postfix/Sendmail funktioniert das out-of-the-box.
//  Für externe SMTP-Server (Mailgun/SendGrid/Office365) bitte PHPMailer
//  installieren und in send_digest_mail() austauschen.
//
//  Nicht-Live-getestet — braucht echten MTA auf dem Zielserver.
// ============================================================

declare(strict_types=1);

// Skript läuft unabhängig von cors() etc. — eigene minimale Bootstrap
require_once __DIR__ . '/../api/config.php';

if (PHP_SAPI !== 'cli' && !getenv('FORCE_RUN')) {
    http_response_code(403);
    exit("This script is intended for CLI/Cron use only. Set FORCE_RUN=1 to override.\n");
}

function log_line(string $msg): void {
    fwrite(STDERR, '[' . date('c') . '] ' . $msg . PHP_EOL);
}

try {
    $pdo = db();
} catch (Throwable $e) {
    log_line('DB-Verbindung fehlgeschlagen: ' . $e->getMessage());
    exit(1);
}

// ── App-Daten laden ──────────────────────────────────────────
$row = $pdo->query('SELECT content FROM app_data WHERE id = 1')->fetch();
if (!$row) {
    log_line('Keine app_data — Digest übersprungen');
    exit(0);
}
$data = json_decode($row['content'], true);
if (!is_array($data)) {
    log_line('app_data.content ist kein JSON-Objekt');
    exit(1);
}

$reports = $data['reports']  ?? [];
$projects = $data['projects'] ?? [];
$users    = $data['users']    ?? [];

// ── Metriken berechnen ───────────────────────────────────────
$submittedReports = array_values(array_filter($reports, fn($r) => ($r['status'] ?? '') === 'submitted'));

$today = strtotime('today');
$overdueTasks = [];
foreach ($projects as $p) {
    foreach ($p['tasks'] ?? [] as $t) {
        $dl = $t['deadline'] ?? null;
        if (!$dl) continue;
        if (($t['status'] ?? '') === 'done' || !empty($t['done'])) continue;
        if (strtotime($dl) < $today) $overdueTasks[] = ['project' => $p['title'] ?? '?', 'task' => $t['text'] ?? '?', 'deadline' => $dl];
    }
}

// Azubis ohne Aktivität (letzter Login älter als 7 Tage)
$sevenDaysAgo = $today - 7 * 86400;
$inactiveAzubis = [];
$stmt = $pdo->query(
    "SELECT id, name, email, last_login FROM users
     WHERE role = 'azubi' AND is_active = 1
       AND (last_login IS NULL OR UNIX_TIMESTAMP(last_login) < $sevenDaysAgo)"
);
foreach ($stmt->fetchAll() as $u) {
    $inactiveAzubis[] = $u;
}

// ── Empfänger: Ausbilder + Mentoren mit notifications_enabled ──
$stmt = $pdo->query(
    "SELECT id, name, email FROM users
     WHERE role IN ('ausbilder','mentor')
       AND is_active = 1
       AND notifications_enabled = 1
       AND email IS NOT NULL AND email != ''"
);
$recipients = $stmt->fetchAll();

if (empty($recipients)) {
    log_line('Keine Empfänger mit notifications_enabled — Digest übersprungen');
    exit(0);
}

// ── Mail bauen + versenden ───────────────────────────────────
function build_subject(int $reports, int $tasks, int $inactive): string {
    $bits = [];
    if ($reports > 0)  $bits[] = "$reports Berichte zu prüfen";
    if ($tasks > 0)    $bits[] = "$tasks überfällige Aufgaben";
    if ($inactive > 0) $bits[] = "$inactive inaktive Azubis";
    return 'AzubiBoard Wochenrückblick' . (empty($bits) ? ' — alles im grünen Bereich' : ': ' . implode(', ', $bits));
}

function build_body(array $recipient, array $reports, array $tasks, array $inactive): string {
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

    $out .= "Direkt zur App: " . (env('APP_URL', 'https://azubiboard.local')) . "\n";
    $out .= "\nDeaktivieren: Profil → Benachrichtigungen ausschalten\n";
    return $out;
}

function send_digest_mail(string $to, string $subject, string $body): bool {
    $from = env('MAIL_FROM', 'azubiboard@localhost');
    $headers = "From: AzubiBoard <$from>\r\n"
             . "Reply-To: $from\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . "X-Mailer: AzubiBoard-Cron\r\n";
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

$sent = 0; $failed = 0;
$subject = build_subject(count($submittedReports), count($overdueTasks), count($inactiveAzubis));

foreach ($recipients as $r) {
    $body = build_body($r, $submittedReports, $overdueTasks, $inactiveAzubis);
    if (send_digest_mail($r['email'], $subject, $body)) {
        $sent++;
    } else {
        $failed++;
        log_line("Mail-Versand an {$r['email']} fehlgeschlagen");
    }
}

log_line("Digest fertig: $sent versendet, $failed fehlgeschlagen, " .
         count($submittedReports) . " Reports / " .
         count($overdueTasks) . " Tasks / " .
         count($inactiveAzubis) . " inaktive Azubis");
exit($failed > 0 ? 1 : 0);
