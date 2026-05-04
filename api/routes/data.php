<?php
// ============================================================
//  Route: GET|POST /api/data
//  Speichert den kompletten App-State als JSON in der DB.
//  Tabelle: app_data (id PK, content JSON, updated_at TIMESTAMP)
// ============================================================

$auth = require_auth();

// ── Tabelle anlegen wenn nicht vorhanden ─────────────────────
db()->exec("
    CREATE TABLE IF NOT EXISTS app_data (
        id         INT UNSIGNED NOT NULL DEFAULT 1,
        content    LONGTEXT     NOT NULL,
        updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── GET /api/data ────────────────────────────────────────────
if ($method === 'GET') {
    $row = db()->query('SELECT content FROM app_data WHERE id = 1')->fetch();
    if (!$row) {
        respond(['projects'=>[],'users'=>[],'groups'=>[],'calendarEvents'=>[],'reports'=>[]]);
    }
    $data = json_decode($row['content'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error('Datenfehler: gespeichertes JSON ist ungültig', 500);
    }
    respond($data);
}

// ── POST /api/data ───────────────────────────────────────────
if ($method === 'POST') {
    // Nur ausbilder darf den globalen State komplett überschreiben,
    // azubis dürfen ebenfalls (damit ihre Änderungen gespeichert werden)
    $raw = file_get_contents('php://input');
    if (empty($raw)) error('Kein Inhalt', 400);

    // Validierung: muss gültiges JSON sein
    json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) error('Ungültiges JSON', 400);

    // Größenbegrenzung: max 10 MB
    if (strlen($raw) > 10 * 1024 * 1024) error('Daten zu groß (max 10 MB)', 413);

    $stmt = db()->prepare("
        INSERT INTO app_data (id, content) VALUES (1, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    ");
    $stmt->execute([$raw]);

    respond(['ok' => true]);
}

error('Methode nicht erlaubt', 405);
