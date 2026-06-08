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
//  Versand via api/mailer.php → send_mail(): nutzt PHPMailer/SMTP wenn
//  SMTP_HOST gesetzt ist (config.php / .env), sonst Fallback auf native
//  mail(). Für externe Provider (Mailgun/SendGrid/Office365) nur die
//  SMTP_*-Env-Vars setzen — kein Code-Eingriff nötig.
//
//  Inhalts-Logik (Metriken/Betreff/Body) liegt in digest_lib.php (unit-
//  getestet: tests/php/DigestTest.php). Der SMTP-Versand selbst ist nur
//  gegen einen echten MTA verifizierbar ([Server]).
// ============================================================

declare(strict_types=1);

// Skript läuft unabhängig von cors() etc. — eigene minimale Bootstrap
require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/mailer.php';
require_once __DIR__ . '/digest_lib.php';   // reine, testbare Digest-Helfer

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

// ── Metriken berechnen (reine Helfer aus digest_lib.php) ─────
$submittedReports = digest_submitted_reports($reports);

$today = strtotime('today');
$overdueTasks = digest_overdue_tasks($projects, $today);

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

// ── Mail bauen + versenden (Inhalt aus digest_lib.php) ───────
function send_digest_mail(string $to, string $subject, string $body): bool {
    return send_mail($to, $subject, $body);
}

$sent = 0; $failed = 0;
$appUrl  = (string) env('APP_URL', 'https://azubiboard.local');
$subject = digest_subject(count($submittedReports), count($overdueTasks), count($inactiveAzubis));

foreach ($recipients as $r) {
    $body = digest_body($r, $submittedReports, $overdueTasks, $inactiveAzubis, $appUrl);
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
