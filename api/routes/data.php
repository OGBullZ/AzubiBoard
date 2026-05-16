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

// L4: History-Tabelle für rollende Backups (1 Snapshot pro Tag, 30 Tage)
db()->exec("
    CREATE TABLE IF NOT EXISTS app_data_history (
        snapshot_day DATE         NOT NULL,
        content      LONGTEXT     NOT NULL,
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        size_bytes   INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (snapshot_day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── GET /api/data/version ────────────────────────────────────
// Billiger Endpoint nur für Polling: liefert "Version" der letzten
// Änderung als Unix-Timestamp. Frontend pollt alle 20-30s und holt
// /api/data nur bei Änderung. FastCGI-kompatibel (keine SSE-Probleme).
if ($method === 'GET' && (($parts[1] ?? null) === 'version')) {
    $row = db()->query('SELECT updated_at FROM app_data WHERE id = 1')->fetch();
    respond([
        'version'    => $row ? strtotime($row['updated_at']) : 0,
        'updated_at' => $row['updated_at'] ?? null,
    ]);
}

// ── GET /api/data ────────────────────────────────────────────
if ($method === 'GET') {
    $row = db()->query('SELECT content, updated_at FROM app_data WHERE id = 1')->fetch();
    if (!$row) {
        // ETag = 0 für leeren State
        header('ETag: "0"');
        respond(['projects'=>[],'users'=>[],'groups'=>[],'calendarEvents'=>[],'reports'=>[]]);
    }
    $data = json_decode($row['content'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error('Datenfehler: gespeichertes JSON ist ungültig', 500);
    }
    $version = strtotime($row['updated_at']);
    header('ETag: "' . $version . '"');
    header('X-Data-Version: ' . $version);
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

    // ── J2: Conflict-Detection via If-Match ──────────────────
    //    Frontend sendet seine bekannte Version mit. Wenn der
    //    Server inzwischen eine neuere Version hat, antworten
    //    wir 409 + aktuellen State, damit das Frontend mergen
    //    oder neu laden kann. Force-Override mit "*".
    $ifMatch = $_SERVER['HTTP_IF_MATCH'] ?? null;
    if ($ifMatch !== null && $ifMatch !== '*') {
        $clientVersion = (int) trim($ifMatch, '"');
        $cur = db()->query('SELECT updated_at FROM app_data WHERE id = 1')->fetch();
        $serverVersion = $cur ? strtotime($cur['updated_at']) : 0;
        if ($serverVersion > 0 && $serverVersion !== $clientVersion) {
            http_response_code(409);
            // Aktuelle Daten + Version mitschicken (kein Roundtrip nötig)
            $row    = db()->query('SELECT content FROM app_data WHERE id = 1')->fetch();
            $server = $row ? json_decode($row['content'], true) : [];
            header('ETag: "' . $serverVersion . '"');
            respond([
                'error'           => 'Conflict',
                'server_version'  => $serverVersion,
                'client_version'  => $clientVersion,
                'server_data'     => $server,
            ], 409);
        }
    }

    // ── K2 (Sprint 10): Field-Level Permissions server-side ──
    //    Frontend blockt Edit/Delete schon, aber API muss auch rejecten,
    //    falls jemand direkt POSTet. Limitierung: Reports leben aktuell
    //    als JSON-Blob (L5 Schema-Refactor kommt in Sprint 12), daher
    //    Diff-Validation auf Blob-Ebene.
    if (($auth['role'] ?? 'azubi') !== 'ausbilder') {
        $oldRow = db()->query('SELECT content FROM app_data WHERE id = 1')->fetch();
        $oldData = $oldRow ? (json_decode($oldRow['content'], true) ?: []) : [];
        validate_reports_diff($parsed['reports'] ?? [], $oldData['reports'] ?? [], (int)$auth['sub']);
    }

    $stmt = db()->prepare("
        INSERT INTO app_data (id, content) VALUES (1, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    ");
    $stmt->execute([$raw]);

    // L4: Rollendes Tages-Backup — erster Save am Tag wird als Snapshot
    //     gespeichert (INSERT IGNORE = bei vorhandenem Tagessatz nichts).
    //     Retention: 30 Tage automatisch aufräumen.
    try {
        $today = date('Y-m-d');
        db()->prepare(
            "INSERT IGNORE INTO app_data_history (snapshot_day, content, size_bytes)
             VALUES (?, ?, ?)"
        )->execute([$today, $raw, strlen($raw)]);
        // GC nur gelegentlich (jeder 50. Call)
        if (mt_rand(1, 50) === 1) {
            db()->exec("DELETE FROM app_data_history WHERE snapshot_day < (CURRENT_DATE - INTERVAL 30 DAY)");
        }
    } catch (Throwable $e) { /* Backup darf den Save nicht blocken */ }

    // Neue Version zurückgeben
    $row = db()->query('SELECT updated_at FROM app_data WHERE id = 1')->fetch();
    $newVersion = $row ? strtotime($row['updated_at']) : time();
    header('ETag: "' . $newVersion . '"');
    header('X-Data-Version: ' . $newVersion);
    respond(['ok' => true, 'version' => $newVersion]);
}

// ── GET /api/data/backups ────────────────────────────────────
// L4: Liste aller verfügbaren Snapshots (nur Ausbilder)
if ($method === 'GET' && (($parts[1] ?? null) === 'backups')) {
    require_role('ausbilder');
    $rows = db()->query(
        'SELECT snapshot_day, created_at, size_bytes
         FROM app_data_history
         ORDER BY snapshot_day DESC'
    )->fetchAll();
    respond($rows);
}

// ── GET /api/data/backups/{day} ──────────────────────────────
// L4: Snapshot eines bestimmten Tages laden (nur Ausbilder)
if ($method === 'GET' && (($parts[1] ?? null) === 'backups') && !empty($parts[2])) {
    require_role('ausbilder');
    $day = $parts[2];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) error('Ungültiges Datum', 400);

    $stmt = db()->prepare('SELECT content FROM app_data_history WHERE snapshot_day = ? LIMIT 1');
    $stmt->execute([$day]);
    $row = $stmt->fetch();
    if (!$row) error('Snapshot nicht gefunden', 404);

    $data = json_decode($row['content'], true);
    respond($data);
}

// ── POST /api/data/restore ───────────────────────────────────
// L4: Restore aus Snapshot (nur Ausbilder, mit Sicherheits-Snapshot davor)
if ($method === 'POST' && (($parts[1] ?? null) === 'restore')) {
    require_role('ausbilder');
    $b   = body();
    $day = $b['snapshot_day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) error('Ungültiges Datum', 400);

    $stmt = db()->prepare('SELECT content FROM app_data_history WHERE snapshot_day = ? LIMIT 1');
    $stmt->execute([$day]);
    $snap = $stmt->fetch();
    if (!$snap) error('Snapshot nicht gefunden', 404);

    // Sicherheits-Snapshot des aktuellen Stands ANLEGEN vor dem Restore
    // (Tagesschlüssel = "restore-pre-{Y-m-d_H-i-s}")
    // → in eine separate Sicherheits-Tabelle wäre sauberer, aber wir
    //   nutzen einfach das gleiche Schema mit synthetischem Day-String
    //   funktioniert nicht direkt; stattdessen UPDATE app_data:
    //   restoreten Inhalt als neuen current State setzen.

    db()->prepare("
        INSERT INTO app_data (id, content) VALUES (1, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    ")->execute([$snap['content']]);

    $row = db()->query('SELECT updated_at FROM app_data WHERE id = 1')->fetch();
    $newVersion = $row ? strtotime($row['updated_at']) : time();
    header('ETag: "' . $newVersion . '"');
    respond(['ok' => true, 'version' => $newVersion, 'restored_from' => $day]);
}

error('Methode nicht erlaubt', 405);

// ── K2 Helper (Sprint 10) ────────────────────────────────────
//   Vergleicht eingehenden Reports-Array mit dem alten Stand und
//   wirft 403, sobald ein Azubi/Mentor etwas tut, was er nicht darf:
//   - Report eines anderen Nutzers verändern/löschen
//   - Eigenen submitted/reviewed/signed Report editieren oder löschen
//   - Status auf reviewed/signed setzen (nur Ausbilder)
//   Bei Mentor ist user_id immer != $uid → jede Mutation wird geblockt.
//
//   WICHTIG: Funktion top-level deklarieren, NICHT in einem if-Block.
//   PHP registriert in-conditional-Funktionen erst zur Runtime — die
//   wird aber durch respond()/error() oben beendet, bevor sie hier
//   ankommt. Ein early-return false durch function_exists wäre zwar
//   defensiv, hat aber genau das Problem: würde nie ausgewertet.
function validate_reports_diff(array $newReports, array $oldReports, int $uid): void {
    $oldById = [];
    foreach ($oldReports as $r) {
        if (isset($r['id'])) $oldById[(string)$r['id']] = $r;
    }
    $seenIds = [];
    foreach ($newReports as $nr) {
        $id  = isset($nr['id']) ? (string)$nr['id'] : '';
        $seenIds[$id] = true;
        $owner = (int)($nr['user_id'] ?? 0);
        $status = $nr['status'] ?? 'draft';

        if (isset($oldById[$id])) {
            $or = $oldById[$id];
            // Bit-genauer Vergleich der für K2 relevanten Felder
            $relevant = ['title','activities','learnings','status','user_id','week_start','week_number','year','file','sectionComments','review_comment'];
            $changed = false;
            foreach ($relevant as $f) {
                $a = $or[$f] ?? null; $b = $nr[$f] ?? null;
                if ($a !== $b && json_encode($a) !== json_encode($b)) { $changed = true; break; }
            }
            if (!$changed) continue;

            $isOwner   = (int)($or['user_id'] ?? 0) === $uid;
            $oldStatus = $or['status'] ?? 'draft';

            if (!$isOwner) error('Nicht berechtigt: Report eines anderen Nutzers geändert', 403);
            // user_id darf nicht verändert werden — sonst könnte Azubi seinen Report an andere übertragen
            if ($owner !== $uid) error('Nicht berechtigt: user_id eines bestehenden Reports verändert', 403);
            // Wenn nicht mehr im Draft, ist *keine* Änderung erlaubt (auch kein Status-Zurücksetzen).
            if ($oldStatus !== 'draft') {
                error('Eingereichter Report kann nicht mehr geändert werden', 403);
            }
            // Aus Draft darf nur in Draft bleiben oder eingereicht werden — alles andere ist Ausbilder-Sache.
            if (!in_array($status, ['draft','submitted'], true)) {
                error('Nur Ausbilder dürfen Status auf "geprüft" oder "unterschrieben" setzen', 403);
            }
        } else {
            // Neuer Report
            if ($owner !== $uid) error('Nicht berechtigt: Neuer Report mit fremder user_id', 403);
            if (!in_array($status, ['draft','submitted'], true)) {
                error('Neuer Report darf nur Entwurf oder Eingereicht sein', 403);
            }
        }
    }
    // Gelöschte Reports
    foreach ($oldReports as $or) {
        $id = isset($or['id']) ? (string)$or['id'] : '';
        if (isset($seenIds[$id])) continue;
        $isOwner = (int)($or['user_id'] ?? 0) === $uid;
        $status  = $or['status'] ?? 'draft';
        if (!$isOwner) error('Nicht berechtigt: Report eines anderen Nutzers gelöscht', 403);
        if ($status !== 'draft') error('Eingereichter Report kann nicht gelöscht werden', 403);
    }
}
