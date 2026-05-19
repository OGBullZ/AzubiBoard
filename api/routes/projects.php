<?php
// ============================================================
//  Route: /api/projects[/:id[/tasks[/:taskId]]]
//  Sprint 12 L5-2: Relationale Projekte + Tasks + Assignments
//
//  GET    /api/projects              → Liste (RLS: Azubi = eigene Gruppe)
//  GET    /api/projects/:id          → Projekt + Tasks + Requirements + Materials
//  POST   /api/projects              → Erstellen
//  PATCH  /api/projects/:id          → Aktualisieren
//  DELETE /api/projects/:id          → Archivieren (soft-delete)
//
//  POST   /api/projects/:id/tasks           → Task erstellen
//  PATCH  /api/projects/:id/tasks/:taskId   → Task aktualisieren
//  DELETE /api/projects/:id/tasks/:taskId   → Task löschen
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];
$role = $auth['role'] ?? 'azubi';

$taskId = isset($parts[3]) && is_numeric($parts[3]) ? (int)$parts[3] : null;
$sub2   = $parts[2] ?? null;  // 'tasks'

// ── Row-Level-Security helper ─────────────────────────────────
// Ausbilder sehen alle, Azubi nur Projekte seiner Gruppe(n).
function project_visible(PDO $pdo, int $projectId, int $userId, string $role): bool {
    if ($role === 'ausbilder') return true;
    $s = $pdo->prepare("
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = ? AND pa.user_id = ?
        LIMIT 1
    ");
    $s->execute([$projectId, $userId]);
    return (bool)$s->fetchColumn();
}

function load_project(PDO $pdo, int $id): ?array {
    $s = $pdo->prepare("SELECT * FROM projects WHERE id = ? AND archived = 0 LIMIT 1");
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

function enrich_project(PDO $pdo, array $p): array {
    $pid = (int)$p['id'];

    // Tasks
    $s = $pdo->prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order, id");
    $s->execute([$pid]);
    $p['tasks'] = $s->fetchAll();

    // Requirements
    $s = $pdo->prepare("SELECT * FROM requirements WHERE project_id = ? ORDER BY sort_order, id");
    $s->execute([$pid]);
    $p['requirements'] = $s->fetchAll();

    // Materials
    $s = $pdo->prepare("SELECT * FROM materials WHERE project_id = ? ORDER BY sort_order, id");
    $s->execute([$pid]);
    $p['materials'] = $s->fetchAll();

    // Assignments (Mitglieder)
    $s = $pdo->prepare("
        SELECT pa.user_id, u.name, u.email, u.role AS user_role
        FROM project_assignments pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.project_id = ?
    ");
    $s->execute([$pid]);
    $p['members'] = $s->fetchAll();

    return $p;
}

// ─────────────────────────────────────────────────────────────
//  Task-Subrouten: /api/projects/:id/tasks[/:taskId]
// ─────────────────────────────────────────────────────────────
if ($sub2 === 'tasks' && $id !== null) {
    if (!project_visible(db(), $id, $uid, $role)) error('Kein Zugriff', 403);

    // POST /api/projects/:id/tasks — Task erstellen
    if ($method === 'POST' && $taskId === null) {
        $b = body();
        $title = trim($b['title'] ?? $b['text'] ?? '');
        if (!$title) error('title erforderlich', 400);

        $taskStatus = in_array($b['status'] ?? '', ['open','in_progress','done','blocked','waiting'])
            ? $b['status'] : 'open';
        $taskPrio   = in_array($b['priority'] ?? '', ['low','medium','high']) ? $b['priority'] : 'medium';
        $assignedTo = !empty($b['assigned_to']) ? (int)$b['assigned_to'] : null;

        $s = db()->prepare("
            INSERT INTO tasks
                (project_id, assigned_to, created_by, title, description, note, doc, protocol,
                 status, priority, due_date, estimated_minutes, sort_order)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,
                (SELECT COALESCE(MAX(sort_order),0)+1 FROM tasks t2 WHERE t2.project_id=?)
            )
        ");
        $s->execute([
            $id, $assignedTo, $uid,
            $title,
            $b['description'] ?? null,
            $b['note'] ?? null,
            $b['doc']  ?? null,
            $b['protocol'] ?? null,
            $taskStatus,
            $taskPrio,
            !empty($b['due_date']) ? $b['due_date'] : null,
            !empty($b['estimated_minutes']) ? (int)$b['estimated_minutes'] : null,
            $id,
        ]);
        $newTask = db()->query("SELECT * FROM tasks WHERE id = " . (int)db()->lastInsertId())->fetch();
        respond($newTask, 201);
    }

    // PATCH /api/projects/:id/tasks/:taskId — Task aktualisieren
    if ($method === 'PATCH' && $taskId !== null) {
        $b = body();
        $fields = [];
        $vals   = [];
        $allowed = ['title','description','note','doc','protocol','status','priority','due_date',
                    'estimated_minutes','sort_order','assigned_to','completed_at'];
        foreach ($allowed as $f) {
            if (!array_key_exists($f, $b)) continue;
            if ($f === 'status') {
                if (!in_array($b[$f], ['open','in_progress','done','blocked','waiting'])) continue;
                if ($b[$f] === 'done') {
                    $fields[] = 'completed_at = COALESCE(completed_at, NOW())';
                } else {
                    $fields[] = 'completed_at = NULL';
                }
            }
            $fields[] = "`$f` = ?";
            $vals[]   = $b[$f] === '' ? null : $b[$f];
        }
        // title aus 'text' (Blob-Kompatibilität)
        if (!array_key_exists('title', $b) && array_key_exists('text', $b)) {
            $fields[] = '`title` = ?';
            $vals[]   = $b['text'];
        }
        if (!$fields) error('Keine Felder zum Aktualisieren', 400);

        $vals[] = $taskId;
        $vals[] = $id;
        db()->prepare("UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = ? AND project_id = ?")
            ->execute($vals);

        $task = db()->query("SELECT * FROM tasks WHERE id = $taskId")->fetch();
        respond($task ?: ['ok' => true]);
    }

    // DELETE /api/projects/:id/tasks/:taskId
    if ($method === 'DELETE' && $taskId !== null) {
        db()->prepare("DELETE FROM tasks WHERE id = ? AND project_id = ?")
            ->execute([$taskId, $id]);
        respond(['ok' => true]);
    }

    error('Methode nicht erlaubt', 405);
}

// ─────────────────────────────────────────────────────────────
//  Haupt-Routen
// ─────────────────────────────────────────────────────────────

// GET /api/projects — Liste
if ($method === 'GET' && $id === null) {
    if ($role === 'ausbilder') {
        $rows = db()->query("SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC")->fetchAll();
    } else {
        $rows = db()->prepare("
            SELECT p.* FROM projects p
            JOIN project_assignments pa ON pa.project_id = p.id
            WHERE pa.user_id = ? AND p.archived = 0
            ORDER BY p.updated_at DESC
        ");
        $rows->execute([$uid]);
        $rows = $rows->fetchAll();
    }
    respond($rows);
}

// GET /api/projects/:id
if ($method === 'GET' && $id !== null) {
    $p = load_project(db(), $id);
    if (!$p) error('Projekt nicht gefunden', 404);
    if (!project_visible(db(), $id, $uid, $role)) error('Kein Zugriff', 403);
    respond(enrich_project(db(), $p));
}

// POST /api/projects — Erstellen
if ($method === 'POST' && $id === null) {
    $b = body();
    $title = trim($b['title'] ?? '');
    if (!$title) error('title erforderlich', 400);

    $status   = in_array($b['status'] ?? '', ['green','yellow','red']) ? $b['status'] : 'yellow';
    $priority = in_array($b['priority'] ?? '', ['low','medium','high','critical']) ? $b['priority'] : 'medium';
    $unit     = in_array($b['netzplan_unit'] ?? '', ['W','T','M']) ? $b['netzplan_unit'] : 'W';

    $s = db()->prepare("
        INSERT INTO projects
            (group_id, created_by, title, description, status, priority,
             start_date, deadline, netzplan_unit, color)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    ");
    $s->execute([
        !empty($b['group_id']) ? (int)$b['group_id'] : null,
        $uid,
        $title,
        $b['description'] ?? null,
        $status,
        $priority,
        !empty($b['start_date']) ? $b['start_date'] : null,
        !empty($b['deadline'])   ? $b['deadline'] : null,
        $unit,
        $b['color'] ?? null,
    ]);
    $newId = (int)db()->lastInsertId();

    // Ersteller automatisch zuweisen
    db()->prepare("INSERT IGNORE INTO project_assignments (project_id, user_id, assigned_by) VALUES (?,?,?)")
        ->execute([$newId, $uid, $uid]);

    $p = load_project(db(), $newId);
    respond(enrich_project(db(), $p), 201);
}

// PATCH /api/projects/:id — Aktualisieren
if ($method === 'PATCH' && $id !== null) {
    $p = load_project(db(), $id);
    if (!$p) error('Projekt nicht gefunden', 404);
    if (!project_visible(db(), $id, $uid, $role)) error('Kein Zugriff', 403);

    $b = body();
    $fields = []; $vals = [];
    $allowed = ['title','description','status','priority','start_date','deadline',
                'netzplan_unit','color','archived','completed_at'];
    foreach ($allowed as $f) {
        if (!array_key_exists($f, $b)) continue;
        if ($f === 'status' && !in_array($b[$f], ['green','yellow','red'])) continue;
        if ($f === 'priority' && !in_array($b[$f], ['low','medium','high','critical'])) continue;
        $fields[] = "`$f` = ?";
        $vals[]   = $b[$f] === '' ? null : $b[$f];
    }
    if (!$fields) error('Keine Felder zum Aktualisieren', 400);
    $vals[] = $id;
    db()->prepare("UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);

    $p = load_project(db(), $id) ?? array_merge($p, ['archived' => 1]);
    respond(enrich_project(db(), $p));
}

// DELETE /api/projects/:id — Archivieren
if ($method === 'DELETE' && $id !== null) {
    if ($role !== 'ausbilder') {
        $own = db()->prepare("SELECT 1 FROM projects WHERE id = ? AND created_by = ? LIMIT 1");
        $own->execute([$id, $uid]);
        if (!$own->fetchColumn()) error('Nur Ausbilder oder Ersteller können Projekte archivieren', 403);
    }
    db()->prepare("UPDATE projects SET archived = 1 WHERE id = ?")->execute([$id]);
    respond(['ok' => true]);
}

error('Methode nicht erlaubt', 405);
