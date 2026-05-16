<?php
// ============================================================
//  Route: /api/users  (GET / POST / PATCH / DELETE)
// ============================================================

// ── GET /api/users ── Nutzerliste (alle eingeloggten Nutzer) ─
if ($method === 'GET' && !$id) {
    require_auth();
    $stmt = db()->query("
        SELECT id, name, email, role, avatar_url,
               apprenticeship_year, profession, theme,
               is_active, last_login
        FROM users
        ORDER BY role DESC, name ASC
    ");
    $users = array_map(function($u) {
        $u['id']                  = (int)$u['id'];
        $u['apprenticeship_year'] = (int)($u['apprenticeship_year'] ?? 1);
        $u['is_active']           = (bool)$u['is_active'];
        return $u;
    }, $stmt->fetchAll());
    respond($users);
}

// ── POST /api/users ── Neuen Azubi anlegen (Ausbilder only) ─
if ($method === 'POST' && !$id) {
    require_role('ausbilder');
    $b     = body();
    $name  = clean_str($b['name'] ?? null, 100, true, 'Name');
    $email = strtolower(trim($b['email'] ?? ''));
    $pw    = $b['password'] ?? '';
    $year  = clean_int($b['apprenticeship_year'] ?? 1, 1, 5, 'Lehrjahr');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL))   error('Ungültige E-Mail-Adresse');
    if (mb_strlen($email) > 254)                      error('E-Mail zu lang', 400);
    if (strlen($pw) < 8)                              error('Passwort muss mindestens 8 Zeichen haben');
    if (strlen($pw) > 200)                            error('Passwort zu lang', 400);

    $chk = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $chk->execute([$email]);
    if ($chk->fetch()) error('Diese E-Mail ist bereits vergeben', 409);

    $hash = password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = db()->prepare(
        'INSERT INTO users (name, email, password_hash, role, apprenticeship_year, is_active)
         VALUES (?, ?, ?, "azubi", ?, 1)'
    );
    $stmt->execute([$name, $email, $hash, $year]);
    $newId = (int)db()->lastInsertId();

    respond([
        'id'                  => $newId,
        'name'                => $name,
        'email'               => $email,
        'role'                => 'azubi',
        'apprenticeship_year' => $year,
        'is_active'           => true,
    ], 201);
}

// ── GET /api/users/{id} ── Einzelnen Nutzer abrufen ──────────
if ($method === 'GET' && $id) {
    require_auth();
    $stmt = db()->prepare(
        'SELECT id, name, email, role, avatar_url, apprenticeship_year,
                profession, theme, is_active, last_login
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) error('Nutzer nicht gefunden', 404);
    $user['id']                  = (int)$user['id'];
    $user['apprenticeship_year'] = (int)$user['apprenticeship_year'];
    $user['is_active']           = (bool)$user['is_active'];
    respond($user);
}

// ── PATCH /api/users/{id} ── Nutzer aktualisieren ────────────
if ($method === 'PATCH' && $id) {
    require_role('ausbilder');
    $b = body();
    $fields = []; $params = [];

    // Passwort ändern (optional, ≥ 8 Zeichen)
    if (!empty($b['password'])) {
        if (strlen($b['password']) < 8)   error('Passwort muss mindestens 8 Zeichen haben');
        if (strlen($b['password']) > 200) error('Passwort zu lang', 400);
        $fields[] = 'password_hash = ?';
        $params[] = password_hash($b['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    }

    // Erlaubte Felder mit Längenlimits
    $limits = [
        'name'                => ['type' => 'str', 'max' => 100],
        'profession'          => ['type' => 'str', 'max' => 120],
        'apprenticeship_year' => ['type' => 'int', 'min' => 1, 'max' => 5],
    ];
    foreach ($limits as $f => $cfg) {
        if (!array_key_exists($f, $b)) continue;
        if ($cfg['type'] === 'str') {
            $params[] = clean_str($b[$f], $cfg['max'], false, $f);
        } else {
            $params[] = clean_int($b[$f], $cfg['min'], $cfg['max'], $f);
        }
        $fields[] = "$f = ?";
    }

    // is_active (de/aktivieren)
    if (array_key_exists('is_active', $b)) {
        $fields[] = 'is_active = ?';
        $params[] = $b['is_active'] ? 1 : 0;
    }

    // M2: role-Wechsel (nur durch Ausbilder, also ist require_role oben schon erfüllt)
    if (array_key_exists('role', $b)) {
        if (!in_array($b['role'], ['azubi', 'mentor', 'ausbilder'], true)) {
            error('Ungültige Rolle', 400);
        }
        // Anti-Lockout: Ausbilder darf sich selbst nicht degradieren wenn er der letzte ist
        $auth = require_auth();
        if ((int)$auth['sub'] === (int)$id && $b['role'] !== 'ausbilder') {
            $stmt = db()->prepare("SELECT COUNT(*) FROM users WHERE role = 'ausbilder' AND is_active = 1 AND id != ?");
            $stmt->execute([$id]);
            if ((int)$stmt->fetchColumn() === 0) error('Letzter aktiver Ausbilder kann nicht degradiert werden', 400);
        }
        $fields[] = 'role = ?';
        $params[] = $b['role'];
    }

    if (empty($fields)) error('Nichts zu aktualisieren');
    $params[] = $id;
    db()->prepare(
        'UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?'
    )->execute($params);
    respond(['message' => 'Nutzer aktualisiert']);
}

// ── DELETE /api/users/{id} ── Nutzer deaktivieren (Soft) ─────
if ($method === 'DELETE' && $id) {
    require_role('ausbilder');
    db()->prepare('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?')
        ->execute([$id]);
    respond(['message' => 'Nutzer deaktiviert']);
}

// ── POST /api/users/{id}/activate ── Nutzer reaktivieren ─────
if ($method === 'POST' && $id && $sub === 'activate') {
    require_role('ausbilder');
    db()->prepare('UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?')
        ->execute([$id]);
    respond(['message' => 'Nutzer aktiviert']);
}

error('Methode nicht erlaubt', 405);
