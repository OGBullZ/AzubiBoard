<?php
// ============================================================
//  Route: /api/auth/*
//  Kopiere nach: api/routes/auth.php
// ============================================================

$sub_action = $parts[1] ?? '';

// ── POST /api/auth/login ─────────────────────────────────────
if ($method === 'POST' && $sub_action === 'login') {
    $b     = body();
    $email = strtolower(trim($b['email'] ?? ''));
    $pw    = $b['password'] ?? '';

    if (!$email || !$pw) error('E-Mail und Passwort erforderlich');

    $stmt = db()->prepare(
        'SELECT id, name, email, password_hash, role, theme,
                apprenticeship_year, profession, avatar_url, is_active
         FROM users WHERE email = ? LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) error('E-Mail oder Passwort falsch', 401);
    if (!password_verify($pw, $user['password_hash'])) error('E-Mail oder Passwort falsch', 401);

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

// ── POST /api/auth/register ──────────────────────────────────
if ($method === 'POST' && $sub_action === 'register') {
    $b     = body();
    $name  = trim($b['name'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));
    $pw    = $b['password'] ?? '';

    if (!$name)                                         error('Name erforderlich');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))     error('Ungültige E-Mail-Adresse');
    if (strlen($pw) < 4)                                error('Passwort muss mindestens 4 Zeichen haben');

    $chk = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $chk->execute([$email]);
    if ($chk->fetch()) error('Diese E-Mail ist bereits registriert', 409);

    $hash = password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = db()->prepare(
        'INSERT INTO users (name, email, password_hash, role, profession, apprenticeship_year)
         VALUES (?, ?, ?, "azubi", ?, ?)'
    );
    $stmt->execute([
        $name,
        $email,
        $hash,
        $b['profession'] ?? null,
        (int)($b['apprenticeship_year'] ?? 1),
    ]);
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
    $allowed = ['name', 'phone', 'profession', 'apprenticeship_year'];
    $fields = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $params[] = $b[$f]; }
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
    $auth = require_auth();
    $b    = body();
    $old  = $b['old_password'] ?? '';
    $new  = $b['new_password'] ?? '';
    if (strlen($new) < 4) error('Neues Passwort muss mindestens 4 Zeichen haben');

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
