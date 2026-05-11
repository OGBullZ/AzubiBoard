<?php
// ============================================================
//  Route: /api/share — Public Read-Share-Links (J10)
//
//  POST   /api/share          (auth required)  → token erstellen
//    body: { kind: 'jahresmappe' | 'bericht', data: {...},
//            ttl_days?: 30, title?: '...' }
//    response: { token, url, expires_at }
//
//  GET    /api/share/{token}  (public)         → Inhalt lesen
//    response: { kind, title, data, created_at, expires_at }
//
//  DELETE /api/share/{token}  (auth required)  → Link revoken
//
//  GET    /api/share          (auth required)  → eigene Links auflisten
// ============================================================

// Tabelle anlegen falls nicht vorhanden
db()->exec("
    CREATE TABLE IF NOT EXISTS share_links (
        token       VARCHAR(64)  NOT NULL PRIMARY KEY,
        owner_id    INT UNSIGNED NOT NULL,
        kind        VARCHAR(32)  NOT NULL,
        title       VARCHAR(200) DEFAULT NULL,
        payload     LONGTEXT     NOT NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at  TIMESTAMP    NULL,
        view_count  INT UNSIGNED NOT NULL DEFAULT 0,
        last_viewed TIMESTAMP    NULL,
        INDEX idx_owner (owner_id),
        INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// Abgelaufene Links gelegentlich aufräumen (1 von 50 Calls)
if (mt_rand(1, 50) === 1) {
    db()->exec("DELETE FROM share_links WHERE expires_at IS NOT NULL AND expires_at < NOW()");
}

$token = $parts[1] ?? null;

// ── GET /api/share/{token} ── PUBLIC, kein Auth ──────────────
if ($method === 'GET' && $token) {
    rate_limit('share_view', 60, 60);  // 60/min pro IP
    if (!preg_match('/^[a-f0-9]{32,64}$/', $token)) error('Ungültiger Token', 400);

    $stmt = db()->prepare('SELECT kind, title, payload, created_at, expires_at FROM share_links WHERE token = ? LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) error('Link nicht gefunden oder bereits widerrufen', 404);
    if ($row['expires_at'] && strtotime($row['expires_at']) < time()) {
        error('Link ist abgelaufen', 410);
    }

    // View-Counter erhöhen (asynchron, kein Fehler bei Race)
    try {
        db()->prepare('UPDATE share_links SET view_count = view_count + 1, last_viewed = NOW() WHERE token = ?')
            ->execute([$token]);
    } catch (Throwable $e) { /* ignore */ }

    $payload = json_decode($row['payload'], true);
    respond([
        'kind'       => $row['kind'],
        'title'      => $row['title'],
        'data'       => $payload,
        'created_at' => $row['created_at'],
        'expires_at' => $row['expires_at'],
    ]);
}

// ── DELETE /api/share/{token} ── Owner only ──────────────────
if ($method === 'DELETE' && $token) {
    $auth = require_auth();
    if (!preg_match('/^[a-f0-9]{32,64}$/', $token)) error('Ungültiger Token', 400);

    $stmt = db()->prepare('SELECT owner_id FROM share_links WHERE token = ? LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) error('Link nicht gefunden', 404);
    if ((int)$row['owner_id'] !== (int)$auth['sub']) error('Nicht berechtigt', 403);

    db()->prepare('DELETE FROM share_links WHERE token = ?')->execute([$token]);
    respond(['message' => 'Link widerrufen']);
}

// ── POST /api/share ── Neuen Link erstellen ──────────────────
if ($method === 'POST' && !$token) {
    rate_limit('share_create', 30, 3600);  // 30 Links/h pro IP (gegen Spam)
    $auth = require_auth();
    $b    = body();

    $kind  = clean_str($b['kind']  ?? null, 32,  true,  'kind');
    $title = isset($b['title']) ? clean_str($b['title'], 200, false, 'title') : null;
    if (!in_array($kind, ['jahresmappe', 'bericht'], true)) error('Unbekannter kind-Wert', 400);

    $data  = $b['data'] ?? null;
    if (!is_array($data)) error('data muss Objekt sein', 400);

    $raw = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($raw === false || strlen($raw) > 5 * 1024 * 1024) error('Daten zu groß (max 5 MB)', 413);

    $ttlDays = clean_int($b['ttl_days'] ?? 30, 1, 365, 'ttl_days');
    $expires = (new DateTime("+{$ttlDays} days"))->format('Y-m-d H:i:s');

    // 32-stelliger hex-Token (128 bit entropy)
    $tk = bin2hex(random_bytes(16));

    db()->prepare(
        'INSERT INTO share_links (token, owner_id, kind, title, payload, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$tk, $auth['sub'], $kind, $title, $raw, $expires]);

    respond([
        'token'      => $tk,
        'expires_at' => $expires,
    ], 201);
}

// ── GET /api/share ── Eigene Links auflisten ─────────────────
if ($method === 'GET' && !$token) {
    $auth = require_auth();
    $stmt = db()->prepare(
        'SELECT token, kind, title, created_at, expires_at, view_count, last_viewed
         FROM share_links
         WHERE owner_id = ?
         ORDER BY created_at DESC
         LIMIT 100'
    );
    $stmt->execute([$auth['sub']]);
    respond($stmt->fetchAll());
}

error('Methode nicht erlaubt', 405);
