<?php
// ============================================================
//  Route: GET /api/users
//  Liefert die Nutzerliste (ohne password_hash).
// ============================================================

$auth = require_auth();

if ($method === 'GET') {
    $stmt = db()->query("
        SELECT id, name, email, role, avatar_url,
               apprenticeship_year, profession, theme
        FROM users
        WHERE is_active = 1
        ORDER BY role DESC, name ASC
    ");
    $users = array_map(function($u) {
        $u['id']                  = (int)$u['id'];
        $u['apprenticeship_year'] = (int)($u['apprenticeship_year'] ?? 1);
        return $u;
    }, $stmt->fetchAll());
    respond($users);
}

error('Methode nicht erlaubt', 405);
