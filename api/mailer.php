<?php
// ============================================================
//  mailer.php — N1 (Sprint 13): SMTP-Versand via PHPMailer
//  Wenn SMTP_HOST gesetzt: PHPMailer mit SMTP.
//  Sonst: Fallback auf native PHP mail().
//
//  Verwendung:
//    require_once __DIR__ . '/mailer.php';
//    $ok = send_mail('to@example.com', 'Betreff', 'Textinhalt');
// ============================================================

function send_mail(string $to, string $subject, string $body, string $htmlBody = ''): bool {
    if (defined('SMTP_HOST') && SMTP_HOST !== '') {
        return _send_via_phpmailer($to, $subject, $body, $htmlBody);
    }
    return _send_via_native_mail($to, $subject, $body);
}

function _send_via_phpmailer(string $to, string $subject, string $body, string $htmlBody): bool {
    $autoload = dirname(__DIR__) . '/vendor/autoload.php';
    if (!file_exists($autoload)) {
        error_log('[mailer] vendor/autoload.php fehlt — Fallback auf mail()');
        return _send_via_native_mail($to, $subject, $body);
    }
    require_once $autoload;

    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        error_log('[mailer] PHPMailer nicht installiert — Fallback auf mail()');
        return _send_via_native_mail($to, $subject, $body);
    }

    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->Port       = SMTP_PORT;
        $mail->SMTPAuth   = (SMTP_USER !== '');

        if (SMTP_SECURE === 'ssl') {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif (SMTP_SECURE === 'tls') {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure = '';
            $mail->SMTPAutoTLS = false;
        }

        if (SMTP_USER !== '') {
            $mail->Username = SMTP_USER;
            $mail->Password = SMTP_PASS;
        }

        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->CharSet  = 'UTF-8';
        $mail->Subject  = $subject;

        if ($htmlBody !== '') {
            $mail->isHTML(true);
            $mail->Body    = $htmlBody;
            $mail->AltBody = $body;
        } else {
            $mail->isHTML(false);
            $mail->Body = $body;
        }

        $mail->send();
        return true;
    } catch (Throwable $e) {
        error_log('[mailer] PHPMailer-Fehler: ' . $e->getMessage());
        return false;
    }
}

function _send_via_native_mail(string $to, string $subject, string $body): bool {
    $from    = defined('SMTP_FROM') ? SMTP_FROM : 'azubiboard@localhost';
    $name    = defined('SMTP_FROM_NAME') ? SMTP_FROM_NAME : 'AzubiBoard';
    $headers = "From: $name <$from>\r\n"
             . "Reply-To: $from\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . "X-Mailer: AzubiBoard-Cron\r\n";
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}
