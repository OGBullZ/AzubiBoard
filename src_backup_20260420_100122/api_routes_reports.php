<?php
// ============================================================
//  api/routes/reports.php  –  Berichtshefte
// ============================================================

$auth = require_auth();
$uid  = $auth['sub'];

// ── GET /api/reports ──────────────────────────────────────────
if ($method === 'GET' && $id === null) {
    if ($auth['role'] !== 'azubi') {
        // Ausbilder: alle eingereichten
        $stmt = db()->prepare(
            'SELECT r.*, u.name AS user_name
             FROM reports r
             JOIN users u ON u.id = r.user_id
             WHERE r.status != "draft"
             ORDER BY r.week_start DESC'
        );
        $stmt->execute();
    } else {
        $stmt = db()->prepare(
            'SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC'
        );
        $stmt->execute([$uid]);
    }
    respond($stmt->fetchAll());
}

// ── GET /api/reports/:id ──────────────────────────────────────
if ($method === 'GET' && $id !== null) {
    $stmt = db()->prepare(
        'SELECT r.*, u.name AS user_name, rv.name AS reviewer_name
         FROM reports r
         JOIN  users u  ON u.id  = r.user_id
         LEFT JOIN users rv ON rv.id = r.reviewer_id
         WHERE r.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $report = $stmt->fetch();
    if (!$report) error('Berichtsheft nicht gefunden', 404);

    // Azubi darf nur eigene sehen
    if ($auth['role'] === 'azubi' && (int)$report['user_id'] !== $uid) {
        error('Keine Berechtigung', 403);
    }

    // Tageseinträge
    $e = db()->prepare('SELECT * FROM report_entries WHERE report_id = ? ORDER BY entry_date');
    $e->execute([$id]);
    $report['entries'] = $e->fetchAll();

    // Dateien
    $f = db()->prepare('SELECT * FROM report_files WHERE report_id = ? ORDER BY created_at');
    $f->execute([$id]);
    $report['files'] = $f->fetchAll();

    respond($report);
}

// ── POST /api/reports ─────────────────────────────────────────
if ($method === 'POST' && $id === null) {
    $b = body();
    if (empty($b['week_start'])) error('week_start erforderlich (YYYY-MM-DD)');

    $week_start = $b['week_start'];
    $dt         = new DateTime($week_start);
    $week_num   = (int)$dt->format('W');
    $year       = (int)$dt->format('Y');

    // Doppelter Eintrag prüfen
    $chk = db()->prepare('SELECT id FROM reports WHERE user_id = ? AND week_start = ? LIMIT 1');
    $chk->execute([$uid, $week_start]);
    if ($chk->fetch()) error('Berichtsheft für diese Woche existiert bereits', 409);

    $stmt = db()->prepare(
        'INSERT INTO reports
           (user_id, week_start, week_number, year, title, content, activities, learnings, hours_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $uid,
        $week_start,
        $week_num,
        $year,
        $b['title']      ?? "KW $week_num / $year",
        $b['content']    ?? '',
        $b['activities'] ?? '',
        $b['learnings']  ?? '',
        $b['hours_total'] ?? null,
    ]);
    respond(['id' => (int)db()->lastInsertId()], 201);
}

// ── PUT /api/reports/:id  –  Aktualisieren ────────────────────
if ($method === 'PUT' && $id !== null) {
    $b = body();

    // Nur Drafts können bearbeitet werden
    $chk = db()->prepare('SELECT status, user_id FROM reports WHERE id = ? LIMIT 1');
    $chk->execute([$id]);
    $rep = $chk->fetch();
    if (!$rep) error('Nicht gefunden', 404);
    if ((int)$rep['user_id'] !== $uid) error('Keine Berechtigung', 403);
    if ($rep['status'] !== 'draft') error('Eingereichte Berichte können nicht mehr bearbeitet werden');

    db()->prepare(
        'UPDATE reports SET title=?, content=?, activities=?, learnings=?, hours_total=?, updated_at=NOW()
         WHERE id=?'
    )->execute([
        $b['title']       ?? '',
        $b['content']     ?? '',
        $b['activities']  ?? '',
        $b['learnings']   ?? '',
        $b['hours_total'] ?? null,
        $id,
    ]);
    respond(['message' => 'Gespeichert']);
}

// ── PATCH /api/reports/:id/submit  –  Einreichen ─────────────
if ($method === 'PATCH' && $id !== null && $sub === 'submit') {
    $chk = db()->prepare('SELECT user_id, status FROM reports WHERE id = ? LIMIT 1');
    $chk->execute([$id]);
    $rep = $chk->fetch();
    if (!$rep || (int)$rep['user_id'] !== $uid) error('Keine Berechtigung', 403);
    if ($rep['status'] !== 'draft') error('Bereits eingereicht');

    db()->prepare(
        'UPDATE reports SET status="submitted", submitted_at=NOW(), updated_at=NOW() WHERE id=?'
    )->execute([$id]);
    respond(['message' => 'Berichtsheft eingereicht', 'status' => 'submitted']);
}

// ── PATCH /api/reports/:id/review  –  Ausbilder bewertet ─────
if ($method === 'PATCH' && $id !== null && $sub === 'review') {
    require_role('ausbilder', 'admin');
    $b = body();

    $new_status = in_array($b['status'] ?? '', ['reviewed', 'signed']) ? $b['status'] : 'reviewed';

    db()->prepare(
        'UPDATE reports
         SET status=?, reviewer_id=?, reviewer_comment=?, reviewed_at=NOW(), updated_at=NOW()
         WHERE id=?'
    )->execute([$new_status, $uid, $b['comment'] ?? '', $id]);

    respond(['message' => 'Status aktualisiert', 'status' => $new_status]);
}

// ── DELETE /api/reports/:id ───────────────────────────────────
if ($method === 'DELETE' && $id !== null) {
    $chk = db()->prepare('SELECT user_id, status FROM reports WHERE id = ? LIMIT 1');
    $chk->execute([$id]);
    $rep = $chk->fetch();
    if (!$rep || (int)$rep['user_id'] !== $uid) error('Keine Berechtigung', 403);
    if ($rep['status'] !== 'draft') error('Nur Entwürfe können gelöscht werden');

    db()->prepare('DELETE FROM reports WHERE id=?')->execute([$id]);
    respond(['message' => 'Gelöscht']);
}

error('Report-Route nicht gefunden', 404);
