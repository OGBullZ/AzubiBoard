<?php
// ============================================================
//  api/routes/tasks.php
//  Aufgaben-Routen – angepasst an neues Frontend-Modell
//
//  Feldmapping (Frontend → DB):
//    text       → title
//    assignee   → assigned_to
//    deadline   → due_date
//    status     → status (mit Konvertierung via config.php)
//    doc        → doc        (extra Spalte, siehe ALTER TABLE unten)
//    protocol   → protocol   (extra Spalte, siehe ALTER TABLE unten)
//
//  WICHTIG: Führe diese ALTER TABLE Befehle in phpMyAdmin aus
//  BEVOR du die API verwendest:
//
//  ALTER TABLE tasks
//    ADD COLUMN doc      TEXT NULL AFTER note,
//    ADD COLUMN protocol TEXT NULL AFTER doc,
//    MODIFY COLUMN status ENUM('open','in_progress','done','blocked','waiting')
//      NOT NULL DEFAULT 'open';
// ============================================================

$auth = require_auth();
$uid  = $auth['sub'];

// ── GET /api/tasks?project_id=X ──────────────────────────────
if ($method === 'GET' && $id === null) {
    $pid = (int)($_GET['project_id'] ?? 0);
    if (!$pid) error('project_id erforderlich');

    // Sortierung: zuerst nach Status-Priorität, dann nach Deadline
    $stmt = db()->prepare(
        'SELECT t.*, u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.project_id = ?
         ORDER BY
           FIELD(t.status, "in_progress", "open", "waiting", "blocked", "done"),
           t.due_date IS NULL,
           t.due_date ASC,
           t.sort_order ASC,
           t.created_at ASC'
    );
    $stmt->execute([$pid]);
    $rows = $stmt->fetchAll();

    respond(array_map('format_task', $rows));
}

// ── GET /api/tasks/:id ────────────────────────────────────────
if ($method === 'GET' && $id !== null) {
    $stmt = db()->prepare(
        'SELECT t.*, u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) error('Aufgabe nicht gefunden', 404);
    respond(format_task($row));
}

// ── POST /api/tasks ───────────────────────────────────────────
if ($method === 'POST' && $id === null) {
    $b = body();

    // Pflichtfeld: entweder 'text' (Frontend) oder 'title' (direkt)
    $title = trim($b['text'] ?? $b['title'] ?? '');
    if (!$title) error('Titel (text) erforderlich');

    $pid = (int)($b['project_id'] ?? 0);
    if (!$pid) error('project_id erforderlich');

    $db_status = status_to_db($b['status'] ?? 'not_started');

    $stmt = db()->prepare(
        'INSERT INTO tasks
           (project_id, assigned_to, created_by, title, note, doc, protocol,
            status, priority, due_date, estimated_minutes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $pid,
        $b['assignee'] ?? null,         // Frontend: assignee → DB: assigned_to
        $uid,
        $title,
        $b['note']     ?? '',
        $b['doc']      ?? '',
        $b['protocol'] ?? '',
        $db_status,
        $b['priority'] ?? 'medium',
        $b['deadline'] ?? null,          // Frontend: deadline → DB: due_date
        $b['estimated_minutes'] ?? null,
        $b['sort_order'] ?? 0,
    ]);

    $new_id = (int)db()->lastInsertId();

    // Erstellte Aufgabe zurückgeben
    $stmt2 = db()->prepare('SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to WHERE t.id = ? LIMIT 1');
    $stmt2->execute([$new_id]);
    respond(format_task($stmt2->fetch()), 201);
}

// ── PATCH /api/tasks/:id ──────────────────────────────────────
if ($method === 'PATCH' && $id !== null) {
    $b = body();

    // Feldname-Mapping Frontend → DB
    $field_map = [
        'text'               => 'title',
        'assignee'           => 'assigned_to',
        'deadline'           => 'due_date',
        'note'               => 'note',
        'doc'                => 'doc',
        'protocol'           => 'protocol',
        'priority'           => 'priority',
        'sort_order'         => 'sort_order',
        'estimated_minutes'  => 'estimated_minutes',
        // 'status' wird separat behandelt (Konvertierung)
    ];

    $fields = []; $params = [];

    foreach ($field_map as $frontend => $db_col) {
        if (array_key_exists($frontend, $b)) {
            $fields[] = "$db_col = ?";
            $params[] = $b[$frontend];
        }
    }

    // Status konvertieren
    if (array_key_exists('status', $b)) {
        $db_status = status_to_db($b['status']);
        $fields[]  = 'status = ?';
        $params[]  = $db_status;
        // completed_at setzen wenn erledigt
        if ($db_status === 'done') {
            $fields[] = 'completed_at = NOW()';
        } elseif ($db_status !== 'done') {
            $fields[] = 'completed_at = NULL';
        }
    }

    if (empty($fields)) error('Nichts zu aktualisieren');

    $params[] = $id;
    db()->prepare(
        'UPDATE tasks SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?'
    )->execute($params);

    // Aktualisierte Aufgabe zurückgeben
    $stmt = db()->prepare('SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to WHERE t.id = ? LIMIT 1');
    $stmt->execute([$id]);
    respond(format_task($stmt->fetch()));
}

// ── DELETE /api/tasks/:id ─────────────────────────────────────
if ($method === 'DELETE' && $id !== null) {
    db()->prepare('DELETE FROM tasks WHERE id = ?')->execute([$id]);
    respond(['message' => 'Aufgabe gelöscht', 'id' => $id]);
}

error('Task-Route nicht gefunden', 404);
