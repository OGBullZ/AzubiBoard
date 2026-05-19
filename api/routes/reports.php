<?php
// ============================================================
//  Route: /api/reports[/:id]
//  Sprint 12 L5-3: Relationale Berichte
//
//  GET    /api/reports          → Liste (Azubi = eigene, Ausbilder = alle)
//  GET    /api/reports/:id      → Einzelner Bericht
//  POST   /api/reports          → Erstellen
//  PATCH  /api/reports/:id      → Aktualisieren (mit Status-Restriktionen)
//  DELETE /api/reports/:id      → Löschen (nur Entwurf, nur eigene)
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];
$role = $auth['role'] ?? 'azubi';

$VALID_STATUSES = ['draft','submitted','reviewed','signed'];

function load_report(PDO $pdo, int $id): ?array {
    $s = $pdo->prepare("SELECT * FROM reports WHERE id = ? LIMIT 1");
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

// ─────────────────────────────────────────────────────────────

// GET /api/reports — Liste
if ($method === 'GET' && $id === null) {
    $params = [];
    if ($role === 'ausbilder') {
        // Optionaler Filter: ?user_id=X
        if (!empty($_GET['user_id'])) {
            $s = db()->prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC");
            $s->execute([(int)$_GET['user_id']]);
        } else {
            $s = db()->query("SELECT * FROM reports ORDER BY week_start DESC");
        }
    } else {
        $s = db()->prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC");
        $s->execute([$uid]);
    }
    respond($s->fetchAll());
}

// GET /api/reports/:id
if ($method === 'GET' && $id !== null) {
    $r = load_report(db(), $id);
    if (!$r) error('Bericht nicht gefunden', 404);
    if ($role !== 'ausbilder' && (int)$r['user_id'] !== $uid) error('Kein Zugriff', 403);
    respond($r);
}

// POST /api/reports — Erstellen
if ($method === 'POST' && $id === null) {
    $b = body();
    $weekStart = $b['week_start'] ?? '';
    if (!$weekStart || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
        error('week_start (YYYY-MM-DD) erforderlich', 400);
    }

    // Kein Azubi darf für andere erstellen
    $reportUserId = ($role === 'ausbilder' && !empty($b['user_id'])) ? (int)$b['user_id'] : $uid;

    $s = db()->prepare("
        INSERT INTO reports
            (user_id, week_start, week_number, year, title, activities, learnings, status)
        VALUES (?,?,?,?,?,?,?,'draft')
    ");
    $s->execute([
        $reportUserId,
        $weekStart,
        !empty($b['week_number']) ? (int)$b['week_number'] : null,
        !empty($b['year'])        ? (int)$b['year'] : (int)date('Y', strtotime($weekStart)),
        $b['title'] ?? null,
        $b['activities'] ?? null,
        $b['learnings'] ?? null,
    ]);
    respond(load_report(db(), (int)db()->lastInsertId()), 201);
}

// PATCH /api/reports/:id — Aktualisieren
if ($method === 'PATCH' && $id !== null) {
    global $VALID_STATUSES;
    $r = load_report(db(), $id);
    if (!$r) error('Bericht nicht gefunden', 404);

    $isOwner = (int)$r['user_id'] === $uid;
    if ($role !== 'ausbilder' && !$isOwner) error('Kein Zugriff', 403);

    $b = body();
    $newStatus = $b['status'] ?? $r['status'];
    if (!in_array($newStatus, $VALID_STATUSES)) error('Ungültiger Status', 400);

    // Azubi darf nur draft↔submitted; nicht reviewed/signed setzen
    if ($role !== 'ausbilder') {
        if (!in_array($newStatus, ['draft','submitted'])) {
            error('Nur Ausbilder dürfen Status auf reviewed/signed setzen', 403);
        }
        if ($r['status'] !== 'draft' && $r['status'] !== 'submitted') {
            error('Bericht kann nach Prüfung nicht mehr geändert werden', 403);
        }
    }

    $fields = []; $vals = [];
    $textFields = ['title','activities','learnings','reviewer_comment','file_url','signed_file_url'];
    foreach ($textFields as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "`$f` = ?"; $vals[] = $b[$f] ?: null; }
    }
    if (array_key_exists('status', $b)) {
        $fields[] = '`status` = ?';
        $vals[]   = $newStatus;
        // Timestamps setzen
        if ($newStatus === 'submitted' && $r['status'] === 'draft') {
            $fields[] = 'submitted_at = COALESCE(submitted_at, NOW())';
        }
        if ($newStatus === 'reviewed' && $r['status'] !== 'reviewed') {
            $fields[] = 'reviewed_at = NOW()';
            $fields[] = 'reviewer_id = ' . $uid;
        }
        if ($newStatus === 'signed' && $r['status'] !== 'signed') {
            $fields[] = 'signed_at = NOW()';
            $fields[] = 'reviewer_id = COALESCE(reviewer_id, ' . $uid . ')';
        }
    }
    if (!$fields) error('Keine Felder zum Aktualisieren', 400);

    $vals[] = $id;
    db()->prepare("UPDATE reports SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);
    respond(load_report(db(), $id));
}

// DELETE /api/reports/:id — Löschen (nur Entwurf + Eigentümer)
if ($method === 'DELETE' && $id !== null) {
    $r = load_report(db(), $id);
    if (!$r) error('Bericht nicht gefunden', 404);
    if ($role !== 'ausbilder') {
        if ((int)$r['user_id'] !== $uid) error('Kein Zugriff', 403);
        if ($r['status'] !== 'draft') error('Nur Entwürfe können gelöscht werden', 403);
    }
    db()->prepare("DELETE FROM reports WHERE id = ?")->execute([$id]);
    respond(['ok' => true]);
}

error('Methode nicht erlaubt', 405);
