<?php
// ============================================================
//  Route: /api/goals/requirements[/:id] und
//         /api/goals/materials[/:id]
//  Sprint 12 L5-4: Requirements + Materials CRUD
//
//  GET    /api/goals/requirements?project_id=X  → Liste
//  POST   /api/goals/requirements               → Erstellen
//  PATCH  /api/goals/requirements/:id           → Aktualisieren
//  DELETE /api/goals/requirements/:id           → Löschen
//
//  GET    /api/goals/materials?project_id=X     → Liste
//  POST   /api/goals/materials                  → Erstellen
//  PATCH  /api/goals/materials/:id              → Aktualisieren
//  DELETE /api/goals/materials/:id              → Löschen
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];
$role = $auth['role'] ?? 'azubi';

// parts layout: ["goals", "requirements"|"materials", id?]
$entity = $parts[1] ?? '';
$itemId = isset($parts[2]) && is_numeric($parts[2]) ? (int)$parts[2] : null;

if (!in_array($entity, ['requirements','materials'])) {
    error("Unbekannter goals-Typ: '$entity'. Erlaubt: requirements, materials", 404);
}

// ── Projektzugriff prüfen ─────────────────────────────────────
function goals_project_access(PDO $pdo, int $projectId, int $userId, string $role): bool {
    if ($role === 'ausbilder') return true;
    $s = $pdo->prepare("SELECT 1 FROM project_assignments WHERE project_id=? AND user_id=? LIMIT 1");
    $s->execute([$projectId, $userId]);
    return (bool)$s->fetchColumn();
}

// ─────────────────────────────────────────────────────────────
//  REQUIREMENTS
// ─────────────────────────────────────────────────────────────
if ($entity === 'requirements') {

    // GET /api/goals/requirements?project_id=X
    if ($method === 'GET' && $itemId === null) {
        $pid = !empty($_GET['project_id']) ? (int)$_GET['project_id'] : null;
        if (!$pid) error('project_id erforderlich', 400);
        if (!goals_project_access(db(), $pid, $uid, $role)) error('Kein Zugriff', 403);
        $s = db()->prepare("SELECT * FROM requirements WHERE project_id=? ORDER BY sort_order, id");
        $s->execute([$pid]);
        respond($s->fetchAll());
    }

    // POST /api/goals/requirements
    if ($method === 'POST' && $itemId === null) {
        $b   = body();
        $pid = !empty($b['project_id']) ? (int)$b['project_id'] : null;
        if (!$pid) error('project_id erforderlich', 400);
        if (!goals_project_access(db(), $pid, $uid, $role)) error('Kein Zugriff', 403);

        $title = trim($b['title'] ?? '');
        if (!$title) error('title erforderlich', 400);
        $prio = in_array($b['priority'] ?? '', ['must','should','could']) ? $b['priority'] : 'must';

        $s = db()->prepare("
            INSERT INTO requirements (project_id, title, description, done, priority, sort_order)
            VALUES (?,?,?,?,?,
                (SELECT COALESCE(MAX(sort_order),0)+1 FROM requirements r2 WHERE r2.project_id=?)
            )
        ");
        $s->execute([$pid, $title, $b['description'] ?? null, 0, $prio, $pid]);
        $newReq = db()->query("SELECT * FROM requirements WHERE id=".(int)db()->lastInsertId())->fetch();
        respond($newReq, 201);
    }

    // PATCH /api/goals/requirements/:id
    if ($method === 'PATCH' && $itemId !== null) {
        $cur = db()->prepare("SELECT * FROM requirements WHERE id=? LIMIT 1");
        $cur->execute([$itemId]);
        $req = $cur->fetch();
        if (!$req) error('Anforderung nicht gefunden', 404);
        if (!goals_project_access(db(), (int)$req['project_id'], $uid, $role)) error('Kein Zugriff', 403);

        $b = body();
        $fields = []; $vals = [];
        foreach (['title','description','done','priority','sort_order'] as $f) {
            if (!array_key_exists($f, $b)) continue;
            if ($f === 'priority' && !in_array($b[$f], ['must','should','could'])) continue;
            $fields[] = "`$f` = ?";
            $vals[]   = $b[$f];
            if ($f === 'done' && $b[$f]) {
                $fields[] = 'completed_at = COALESCE(completed_at, NOW())';
            } elseif ($f === 'done' && !$b[$f]) {
                $fields[] = 'completed_at = NULL';
            }
        }
        if (!$fields) error('Keine Felder zum Aktualisieren', 400);
        $vals[] = $itemId;
        db()->prepare("UPDATE requirements SET ".implode(', ', $fields)." WHERE id=?")->execute($vals);
        $s = db()->prepare("SELECT * FROM requirements WHERE id=?");
        $s->execute([$itemId]);
        respond($s->fetch());
    }

    // DELETE /api/goals/requirements/:id
    if ($method === 'DELETE' && $itemId !== null) {
        $cur = db()->prepare("SELECT project_id FROM requirements WHERE id=? LIMIT 1");
        $cur->execute([$itemId]);
        $req = $cur->fetch();
        if (!$req) error('Anforderung nicht gefunden', 404);
        if (!goals_project_access(db(), (int)$req['project_id'], $uid, $role)) error('Kein Zugriff', 403);
        db()->prepare("DELETE FROM requirements WHERE id=?")->execute([$itemId]);
        respond(['ok' => true]);
    }
}

// ─────────────────────────────────────────────────────────────
//  MATERIALS
// ─────────────────────────────────────────────────────────────
if ($entity === 'materials') {

    // GET /api/goals/materials?project_id=X
    if ($method === 'GET' && $itemId === null) {
        $pid = !empty($_GET['project_id']) ? (int)$_GET['project_id'] : null;
        if (!$pid) error('project_id erforderlich', 400);
        if (!goals_project_access(db(), $pid, $uid, $role)) error('Kein Zugriff', 403);
        $s = db()->prepare("SELECT * FROM materials WHERE project_id=? ORDER BY sort_order, id");
        $s->execute([$pid]);
        respond($s->fetchAll());
    }

    // POST /api/goals/materials
    if ($method === 'POST' && $itemId === null) {
        $b   = body();
        $pid = !empty($b['project_id']) ? (int)$b['project_id'] : null;
        if (!$pid) error('project_id erforderlich', 400);
        if (!goals_project_access(db(), $pid, $uid, $role)) error('Kein Zugriff', 403);

        $name = trim($b['name'] ?? '');
        if (!$name) error('name erforderlich', 400);

        $s = db()->prepare("
            INSERT INTO materials
                (project_id, name, description, quantity, unit, unit_cost, supplier, ordered, sort_order)
            VALUES (?,?,?,?,?,?,?,?,
                (SELECT COALESCE(MAX(sort_order),0)+1 FROM materials m2 WHERE m2.project_id=?)
            )
        ");
        $s->execute([
            $pid, $name,
            $b['description'] ?? null,
            max(0.01, (float)($b['quantity'] ?? 1)),
            $b['unit'] ?? 'Stück',
            max(0, (float)($b['unit_cost'] ?? 0)),
            $b['supplier'] ?? null,
            !empty($b['ordered']) ? 1 : 0,
            $pid,
        ]);
        $newMat = db()->query("SELECT * FROM materials WHERE id=".(int)db()->lastInsertId())->fetch();
        respond($newMat, 201);
    }

    // PATCH /api/goals/materials/:id
    if ($method === 'PATCH' && $itemId !== null) {
        $cur = db()->prepare("SELECT * FROM materials WHERE id=? LIMIT 1");
        $cur->execute([$itemId]);
        $mat = $cur->fetch();
        if (!$mat) error('Material nicht gefunden', 404);
        if (!goals_project_access(db(), (int)$mat['project_id'], $uid, $role)) error('Kein Zugriff', 403);

        $b = body();
        $fields = []; $vals = [];
        foreach (['name','description','quantity','unit','unit_cost','supplier','ordered','sort_order'] as $f) {
            if (!array_key_exists($f, $b)) continue;
            $fields[] = "`$f` = ?";
            // Bug-Hunt 3 #12: gleiche Clamps/Normalisierung wie im POST
            if ($f === 'quantity')      $vals[] = max(0.01, (float)$b[$f]);
            elseif ($f === 'unit_cost') $vals[] = max(0, (float)$b[$f]);
            elseif ($f === 'ordered')   $vals[] = !empty($b[$f]) ? 1 : 0;
            else                        $vals[] = $b[$f];
        }
        if (!$fields) error('Keine Felder zum Aktualisieren', 400);
        $vals[] = $itemId;
        db()->prepare("UPDATE materials SET ".implode(', ', $fields)." WHERE id=?")->execute($vals);
        $s = db()->prepare("SELECT * FROM materials WHERE id=?");
        $s->execute([$itemId]);
        respond($s->fetch());
    }

    // DELETE /api/goals/materials/:id
    if ($method === 'DELETE' && $itemId !== null) {
        $cur = db()->prepare("SELECT project_id FROM materials WHERE id=? LIMIT 1");
        $cur->execute([$itemId]);
        $mat = $cur->fetch();
        if (!$mat) error('Material nicht gefunden', 404);
        if (!goals_project_access(db(), (int)$mat['project_id'], $uid, $role)) error('Kein Zugriff', 403);
        db()->prepare("DELETE FROM materials WHERE id=?")->execute([$itemId]);
        respond(['ok' => true]);
    }
}

error('Methode nicht erlaubt', 405);
