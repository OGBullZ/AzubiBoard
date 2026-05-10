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
    // 120 Saves pro Minute pro IP – grob 2/Sek; reicht für aktive Nutzer
    rate_limit('data_save', 120, 60);

    // Größencheck *vor* file_get_contents (verhindert OOM bei riesigem Body)
    $declaredLen = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($declaredLen > 10 * 1024 * 1024) error('Daten zu groß (max 10 MB)', 413);

    $raw = file_get_contents('php://input', false, null, 0, 10 * 1024 * 1024 + 1);
    if (empty($raw))                         error('Kein Inhalt', 400);
    if (strlen($raw) > 10 * 1024 * 1024)     error('Daten zu groß (max 10 MB)', 413);

    // Validierung: muss gültiges JSON-Objekt sein (nicht Array, nicht Skalar)
    $parsed = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) error('Ungültiges JSON', 400);
    if (!is_array($parsed))                    error('JSON muss Objekt sein', 400);

    $stmt = db()->prepare("
        INSERT INTO app_data (id, content) VALUES (1, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    ");
    $stmt->execute([$raw]);

    respond(['ok' => true]);
}

error('Methode nicht erlaubt', 405);
