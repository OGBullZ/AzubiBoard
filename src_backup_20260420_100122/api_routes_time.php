<?php
// ============================================================
//  api/routes/time.php  –  Zeiterfassung
// ============================================================

$auth = require_auth();
$uid  = $auth['sub'];

// ── GET /api/time?project_id=X ────────────────────────────────
if ($method === 'GET' && $id === null) {
    $pid = (int)($_GET['project_id'] ?? 0);
    if (!$pid) error('project_id erforderlich');

    $stmt = db()->prepare(
        'SELECT te.*, u.name AS user_name, t.title AS task_title
         FROM time_entries te
         JOIN  users u ON u.id = te.user_id
         LEFT JOIN tasks t ON t.id = te.task_id
         WHERE te.project_id = ?
         ORDER BY te.started_at DESC'
    );
    $stmt->execute([$pid]);
    $rows = $stmt->fetchAll();

    // Laufende Zeit für offene Einträge berechnen
    foreach ($rows as &$r) {
        if ($r['ended_at'] === null) {
            $r['minutes'] = (int)((time() - strtotime($r['started_at'])) / 60);
            $r['running'] = true;
        } else {
            $r['running'] = false;
        }
    }
    respond($rows);
}

// ── GET /api/time/running  –  Läuft gerade ein Timer? ─────────
if ($method === 'GET' && ($parts[1] ?? '') === 'running') {
    $stmt = db()->prepare(
        'SELECT te.*, t.title AS task_title, p.title AS project_title
         FROM time_entries te
         LEFT JOIN tasks    t ON t.id = te.task_id
         LEFT JOIN projects p ON p.id = te.project_id
         WHERE te.user_id = ? AND te.ended_at IS NULL
         ORDER BY te.started_at DESC LIMIT 1'
    );
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    if (!$row) respond(null);
    $row['minutes'] = (int)((time() - strtotime($row['started_at'])) / 60);
    $row['running'] = true;
    respond($row);
}

// ── POST /api/time  –  Timer starten ─────────────────────────
if ($method === 'POST' && $id === null) {
    $b = body();
    $pid = (int)($b['project_id'] ?? 0);
    if (!$pid) error('project_id erforderlich');

    // Laufenden Timer desselben Nutzers stoppen
    db()->prepare(
        'UPDATE time_entries SET ended_at = NOW() WHERE user_id = ? AND ended_at IS NULL'
    )->execute([$uid]);

    $stmt = db()->prepare(
        'INSERT INTO time_entries (project_id, task_id, user_id, description, started_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $stmt->execute([
        $pid,
        $b['task_id']     ?? null,
        $uid,
        $b['description'] ?? '',
    ]);
    respond(['id' => (int)db()->lastInsertId(), 'message' => 'Timer gestartet'], 201);
}

// ── PATCH /api/time/:id/stop  –  Timer stoppen ────────────────
if ($method === 'PATCH' && $id !== null && $sub === 'stop') {
    db()->prepare(
        'UPDATE time_entries SET ended_at = NOW() WHERE id = ? AND user_id = ? AND ended_at IS NULL'
    )->execute([$id, $uid]);
    respond(['message' => 'Timer gestoppt']);
}

// ── DELETE /api/time/:id ──────────────────────────────────────
if ($method === 'DELETE' && $id !== null) {
    db()->prepare('DELETE FROM time_entries WHERE id = ? AND user_id = ?')
        ->execute([$id, $uid]);
    respond(['message' => 'Eintrag gelöscht']);
}

error('Time-Route nicht gefunden', 404);
