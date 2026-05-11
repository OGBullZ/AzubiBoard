<?php
// ============================================================
//  Route: /api/auth/*
//  Kopiere nach: api/routes/auth.php
// ============================================================

$sub_action = $parts[1] ?? '';

// ── K1: Migration für 2FA-Spalten (idempotent, einmalig) ─────
//   Wird bei jedem Auth-Call versucht; MySQL ignoriert ADD COLUMN
//   wenn die Spalte schon existiert (mit "IF NOT EXISTS" in 8.0).
//   Für ältere MySQL-Versionen: try/catch um SQL-Fehler.
try {
    db()->exec("ALTER TABLE users
        ADD COLUMN IF NOT EXISTS totp_secret         VARCHAR(64) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS totp_enabled        TINYINT(1)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS totp_recovery_hash  TEXT        DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS totp_activated_at   TIMESTAMP   NULL DEFAULT NULL");
} catch (Throwable $e) { /* Spalten existieren bereits oder MySQL < 8 — beim 1. Lauf manuell */ }

// ── POST /api/auth/login ─────────────────────────────────────
if ($method === 'POST' && $sub_action === 'login') {
    rate_limit('login', 8, 900);  // 8 Versuche pro 15 min pro IP
    $b     = body();
    $email = strtolower(trim($b['email'] ?? ''));
    $pw    = $b['password'] ?? '';

    if (!$email || !$pw)              error('E-Mail und Passwort erforderlich');
    if (mb_strlen($email) > 254)      error('E-Mail zu lang', 400);
    if (mb_strlen($pw)    > 200)      error('Passwort zu lang', 400);

    $stmt = db()->prepare(
        'SELECT id, name, email, password_hash, role, theme,
                apprenticeship_year, profession, avatar_url, is_active,
                totp_enabled
         FROM users WHERE email = ? LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) error('E-Mail oder Passwort falsch', 401);
    if (!password_verify($pw, $user['password_hash'])) error('E-Mail oder Passwort falsch', 401);

    // K1: Wenn 2FA aktiv → partial-Token + 2FA-Check
    if (!empty($user['totp_enabled'])) {
        $partial = jwt_create([
            'sub'         => (int)$user['id'],
            'pending_2fa' => 1,
        ]);
        respond(['requires_2fa' => true, 'partial_token' => $partial]);
    }

    db()->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
        ->execute([$user['id']]);

    $token = jwt_create([
        'sub'   => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ]);

    respond([
        'token' => $token,
        'user'  => [
            'id'                 => (int)$user['id'],
            'name'               => $user['name'],
            'email'              => $user['email'],
            'role'               => $user['role'],
            'theme'              => $user['theme'] ?? 'dark',
            'avatar_url'         => $user['avatar_url'],
            'apprenticeship_year'=> (int)($user['apprenticeship_year'] ?? 1),
            'profession'         => $user['profession'],
        ],
    ]);
}

// ── K1: POST /api/auth/2fa/check ── 2FA-Code nach Login ──────
if ($method === 'POST' && $sub_action === '2fa' && ($parts[2] ?? '') === 'check') {
    rate_limit('2fa_check', 8, 900);  // 8 Versuche / 15 min
    $b = body();
    $partial = trim($b['partial_token'] ?? '');
    $code    = trim($b['code']          ?? '');
    if (!$partial || !$code) error('Token und Code erforderlich', 400);

    $payload = jwt_verify($partial);
    if (!$payload || empty($payload['pending_2fa'])) error('Token ungültig oder abgelaufen', 401);

    $stmt = db()->prepare(
        'SELECT id, name, email, role, theme, apprenticeship_year, profession,
                avatar_url, is_active, totp_secret, totp_enabled, totp_recovery_hash
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([(int)$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user || !$user['is_active'] || empty($user['totp_enabled']))
        error('Account nicht verfügbar', 401);

    $ok = totp_verify((string)$user['totp_secret'], $code);
    // Recovery-Code als Fallback (Format mit Bindestrich beibehalten)
    if (!$ok && strlen($code) === 11 && !empty($user['totp_recovery_hash'])) {
        $stored = json_decode($user['totp_recovery_hash'], true) ?: [];
        foreach ($stored as $idx => $hash) {
            if (password_verify(strtoupper($code), $hash)) {
                $ok = true;
                // Recovery-Code wird verbraucht (one-time)
                unset($stored[$idx]);
                db()->prepare('UPDATE users SET totp_recovery_hash = ? WHERE id = ?')
                    ->execute([json_encode(array_values($stored)), $user['id']]);
                break;
            }
        }
    }
    if (!$ok) error('Code falsch oder abgelaufen', 401);

    db()->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
        ->execute([$user['id']]);

    $token = jwt_create([
        'sub'   => (int)$user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ]);
    respond([
        'token' => $token,
        'user'  => [
            'id'                  => (int)$user['id'],
            'name'                => $user['name'],
            'email'               => $user['email'],
            'role'                => $user['role'],
            'theme'               => $user['theme'] ?? 'dark',
            'avatar_url'          => $user['avatar_url'],
            'apprenticeship_year' => (int)($user['apprenticeship_year'] ?? 1),
            'profession'          => $user['profession'],
        ],
    ]);
}

// ── K1: POST /api/auth/2fa/setup ── Secret erzeugen (noch nicht aktiv) ─
if ($method === 'POST' && $sub_action === '2fa' && ($parts[2] ?? '') === 'setup') {
    $auth = require_auth();
    $secret = totp_generate_secret(20);
    // In DB schreiben, aber totp_enabled bleibt 0 bis Verify
    db()->prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?')
        ->execute([$secret, $auth['sub']]);
    $email = $auth['email'] ?? '';
    respond([
        'secret'      => $secret,
        'otpauth_url' => totp_uri('AzubiBoard', $email ?: ('user-' . $auth['sub']), $secret),
    ]);
}

// ── K1: POST /api/auth/2fa/verify ── Setup bestätigen ────────
if ($method === 'POST' && $sub_action === '2fa' && ($parts[2] ?? '') === 'verify') {
    rate_limit('2fa_verify', 10, 900);
    $auth = require_auth();
    $code = trim(body()['code'] ?? '');
    if (!preg_match('/^\d{6}$/', $code)) error('6-stelliger Code erforderlich', 400);

    $stmt = db()->prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$auth['sub']]);
    $row = $stmt->fetch();
    if (!$row || empty($row['totp_secret'])) error('Bitte erst Setup ausführen', 400);

    if (!totp_verify((string)$row['totp_secret'], $code)) error('Code falsch', 401);

    // Recovery-Codes erzeugen + hashen, dann zurückgeben
    $codes = totp_generate_recovery_codes(8);
    $hashes = array_map(fn($c) => password_hash($c, PASSWORD_BCRYPT, ['cost' => 10]), $codes);

    db()->prepare(
        'UPDATE users SET totp_enabled = 1, totp_activated_at = NOW(), totp_recovery_hash = ? WHERE id = ?'
    )->execute([json_encode($hashes), $auth['sub']]);

    respond([
        'ok'              => true,
        'recovery_codes'  => $codes,  // Plaintext NUR jetzt — danach hash-only
        'activated_at'    => date('c'),
    ]);
}

// ── K1: POST /api/auth/2fa/disable ── 2FA abschalten ─────────
if ($method === 'POST' && $sub_action === '2fa' && ($parts[2] ?? '') === 'disable') {
    rate_limit('2fa_disable', 5, 3600);
    $auth = require_auth();
    $pw   = body()['password'] ?? '';
    if (mb_strlen($pw) > 200) error('Passwort zu lang', 400);

    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$auth['sub']]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pw, $user['password_hash'])) error('Passwort falsch', 401);

    db()->prepare(
        'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_hash = NULL WHERE id = ?'
    )->execute([$auth['sub']]);

    respond(['ok' => true]);
}

// ── K1: GET /api/auth/2fa/status ─────────────────────────────
if ($method === 'GET' && $sub_action === '2fa' && ($parts[2] ?? '') === 'status') {
    $auth = require_auth();
    $stmt = db()->prepare(
        'SELECT totp_enabled, totp_activated_at,
                CHAR_LENGTH(IFNULL(totp_recovery_hash, "[]")) > 5 AS has_recovery
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$auth['sub']]);
    $row = $stmt->fetch();
    respond([
        'enabled'       => !empty($row['totp_enabled']),
        'activated_at'  => $row['totp_activated_at'] ?? null,
        'has_recovery'  => !empty($row['has_recovery']),
    ]);
}

// ── POST /api/auth/register ──────────────────────────────────
if ($method === 'POST' && $sub_action === 'register') {
    rate_limit('register', 5, 3600);  // 5 Registrierungen pro Stunde pro IP
    $b     = body();
    $name  = clean_str($b['name'] ?? null,   100, true,  'Name');
    $email = strtolower(trim($b['email'] ?? ''));
    $pw    = $b['password'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL))   error('Ungültige E-Mail-Adresse');
    if (mb_strlen($email) > 254)                      error('E-Mail zu lang', 400);
    if (strlen($pw) < 8)                              error('Passwort muss mindestens 8 Zeichen haben');
    if (strlen($pw) > 200)                            error('Passwort zu lang', 400);

    $chk = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $chk->execute([$email]);
    if ($chk->fetch()) error('Diese E-Mail ist bereits registriert', 409);

    $hash = password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);

    $profession = isset($b['profession']) ? clean_str($b['profession'], 120, false, 'Beruf') : null;
    $year       = clean_int($b['apprenticeship_year'] ?? 1, 1, 5, 'Lehrjahr');
    $stmt = db()->prepare(
        'INSERT INTO users (name, email, password_hash, role, profession, apprenticeship_year)
         VALUES (?, ?, ?, "azubi", ?, ?)'
    );
    $stmt->execute([$name, $email, $hash, $profession, $year]);
    $new_id = (int)db()->lastInsertId();

    $token = jwt_create([
        'sub'   => $new_id,
        'name'  => $name,
        'email' => $email,
        'role'  => 'azubi',
    ]);

    respond([
        'token' => $token,
        'user'  => [
            'id'                 => $new_id,
            'name'               => $name,
            'email'              => $email,
            'role'               => 'azubi',
            'theme'              => 'dark',
            'apprenticeship_year'=> (int)($b['apprenticeship_year'] ?? 1),
            'profession'         => $b['profession'] ?? null,
        ],
    ], 201);
}

// ── GET /api/auth/me ─────────────────────────────────────────
if ($method === 'GET' && $sub_action === 'me') {
    $auth = require_auth();

    $stmt = db()->prepare(
        'SELECT id, name, email, role, theme, avatar_url, phone,
                apprenticeship_year, profession, hire_date, end_date,
                notifications_enabled, last_login, department_id
         FROM users WHERE id = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->execute([$auth['sub']]);
    $user = $stmt->fetch();
    if (!$user) error('Nutzer nicht gefunden', 404);

    $user['id']                  = (int)$user['id'];
    $user['apprenticeship_year'] = (int)$user['apprenticeship_year'];
    $user['notifications_enabled'] = (bool)$user['notifications_enabled'];
    respond($user);
}

// ── PATCH /api/auth/profile ──────────────────────────────────
if ($method === 'PATCH' && $sub_action === 'profile') {
    $auth = require_auth();
    $b    = body();
    $limits = [
        'name'                => ['type' => 'str', 'max' => 100],
        'phone'               => ['type' => 'str', 'max' => 30],
        'profession'          => ['type' => 'str', 'max' => 120],
        'apprenticeship_year' => ['type' => 'int', 'min' => 1, 'max' => 5],
    ];
    $fields = []; $params = [];
    foreach ($limits as $f => $cfg) {
        if (!array_key_exists($f, $b)) continue;
        if ($cfg['type'] === 'str') {
            $params[] = clean_str($b[$f], $cfg['max'], false, $f);
        } else {
            $params[] = clean_int($b[$f], $cfg['min'], $cfg['max'], $f);
        }
        $fields[] = "$f = ?";
    }
    if (empty($fields)) error('Nichts zu aktualisieren');
    $params[] = $auth['sub'];
    db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?')
        ->execute($params);
    respond(['message' => 'Profil gespeichert']);
}

// ── PATCH /api/auth/theme ────────────────────────────────────
if ($method === 'PATCH' && $sub_action === 'theme') {
    $auth  = require_auth();
    $theme = body()['theme'] ?? 'dark';
    if (!in_array($theme, ['dark', 'light'])) error('Ungültiger Theme-Wert');
    db()->prepare('UPDATE users SET theme = ? WHERE id = ?')
        ->execute([$theme, $auth['sub']]);
    respond(['theme' => $theme]);
}

// ── PATCH /api/auth/password ─────────────────────────────────
if ($method === 'PATCH' && $sub_action === 'password') {
    rate_limit('password', 10, 3600); // 10 Wechsel pro Stunde pro IP
    $auth = require_auth();
    $b    = body();
    $old  = $b['old_password'] ?? '';
    $new  = $b['new_password'] ?? '';
    if (strlen($new) < 8)   error('Neues Passwort muss mindestens 8 Zeichen haben');
    if (strlen($new) > 200) error('Neues Passwort zu lang', 400);
    if (strlen($old) > 200) error('Aktuelles Passwort zu lang', 400);

    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$auth['sub']]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($old, $user['password_hash'])) {
        error('Aktuelles Passwort falsch', 401);
    }
    $hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([$hash, $auth['sub']]);
    respond(['message' => 'Passwort geändert']);
}

// ── POST /api/auth/logout ────────────────────────────────────
if ($method === 'POST' && $sub_action === 'logout') {
    respond(['message' => 'Logout erfolgreich']);
}

// ── POST /api/auth/avatar ── Profilbild hochladen ─────────────
if ($method === 'POST' && $sub_action === 'avatar') {
    $auth = require_auth();

    if (empty($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK)
        error('Keine gültige Datei hochgeladen');

    $file = $_FILES['avatar'];
    if ($file['size'] > MAX_FILE_MB * 1024 * 1024)
        error('Datei zu groß (max. ' . MAX_FILE_MB . ' MB)');

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']))
        error('Nur Bilder erlaubt (JPEG, PNG, WebP, GIF)');

    // Altes Avatar löschen
    $stmt = db()->prepare('SELECT avatar_url FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$auth['sub']]);
    $old = $stmt->fetchColumn();
    if ($old) {
        $oldFile = UPLOAD_DIR . basename($old);
        if (file_exists($oldFile)) @unlink($oldFile);
    }

    // Neuen Dateinamen erzeugen und Datei verschieben
    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg');
    $filename = 'avatar_' . $auth['sub'] . '_' . time() . '.' . $ext;
    $dest     = UPLOAD_DIR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest))
        error('Datei konnte nicht gespeichert werden');

    // Relativer URL-Pfad (aus SCRIPT_NAME ableiten — funktioniert egal ob / oder /azubiboard/)
    $appBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
    $url     = $appBase . '/uploads/' . $filename;

    db()->prepare('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?')
        ->execute([$url, $auth['sub']]);

    respond(['avatar_url' => $url]);
}

error('Auth-Route nicht gefunden', 404);
