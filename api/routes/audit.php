<?php
// ============================================================
//  Route: /api/audit — Server-side Audit-Log (K5)
//
//  Persistente Tabelle audit_log mit Indizes für effiziente Queries.
//  Schreibvorgänge sind append-only (kein UPDATE/DELETE durch API),
//  damit Logs revisionssicher bleiben. Retention: 365 Tage.
//
//  POST /api/audit         — Eintrag schreiben (auth)
//    body: { type, entity_type?, entity_id?, entity_title?,
//            project_id?, project_title?, action?, meta? }
//
//  GET  /api/audit         — Filterbare Liste (auth)
//    query: ?limit=100&offset=0&type=...&user_id=...
//           &since=YYYY-MM-DD&until=YYYY-MM-DD
//
//  GET  /api/audit/stats   — Aggregat-Counts pro Typ (auth)
//
//  DELETE /api/audit/purge — alle Einträge > 365 Tage (ausbilder)
// ============================================================

// Tabelle anlegen
db()->exec("
    CREATE TABLE IF NOT EXISTS audit_log (
        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ts            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id       INT UNSIGNED    NOT NULL,
        user_name     VARCHAR(100)    DEFAULT NULL,
        user_role     VARCHAR(32)     DEFAULT NULL,
        type          VARCHAR(64)     NOT NULL,
        entity_type   VARCHAR(32)     DEFAULT NULL,
        entity_id     VARCHAR(64)     DEFAULT NULL,
        entity_title  VARCHAR(255)    DEFAULT NULL,
        project_id    VARCHAR(64)     DEFAULT NULL,
        project_title VARCHAR(255)    DEFAULT NULL,
        action        VARCHAR(255)    DEFAULT NULL,
        ip            VARCHAR(45)     DEFAULT NULL,
        ua            VARCHAR(255)    DEFAULT NULL,
        meta          TEXT            DEFAULT NULL,
        INDEX idx_ts        (ts),
        INDEX idx_user_ts   (user_id, ts),
        INDEX idx_type_ts   (type, ts),
        INDEX idx_entity    (entity_type, entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// Auto-Cleanup älter als 365 Tage (probabilistisch, 1/500 calls)
if (mt_rand(1, 500) === 1) {
    db()->exec("DELETE FROM audit_log WHERE ts < (NOW() - INTERVAL 365 DAY)");
}

$sub = $parts[1] ?? null;

// ── POST /api/audit ── Eintrag schreiben ─────────────────────
if ($method === 'POST' && !$sub) {
    rate_limit('audit_write', 300, 60);  // 300/min pro IP — großzügig (Bulk-Imports etc.)
    $auth = require_auth();
    $b    = body();

    $type = clean_str($b['type'] ?? null, 64, true, 'type');
    // Whitelist für entity_type (verhindert Müll)
    $allowedEntities = ['project','task','report','goal','user','calendar','share','data'];
    $entityType = null;
    if (isset($b['entity_type']) && $b['entity_type'] !== '') {
        $et = clean_str($b['entity_type'], 32, false, 'entity_type');
        $entityType = in_array($et, $allowedEntities, true) ? $et : null;
    }

    $stmt = db()->prepare(
        'INSERT INTO audit_log
         (user_id, user_name, user_role, type, entity_type, entity_id, entity_title,
          project_id, project_title, action, ip, ua, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        (int)$auth['sub'],
        clean_str($auth['name'] ?? null, 100, false, 'user_name'),
        clean_str($auth['role'] ?? null, 32,  false, 'user_role'),
        $type,
        $entityType,
        isset($b['entity_id'])    ? clean_str($b['entity_id'],    64,  false, 'entity_id')    : null,
        isset($b['entity_title']) ? clean_str($b['entity_title'], 255, false, 'entity_title') : null,
        isset($b['project_id'])   ? clean_str($b['project_id'],   64,  false, 'project_id')   : null,
        isset($b['project_title'])? clean_str($b['project_title'],255, false, 'project_title'): null,
        isset($b['action'])       ? clean_str($b['action'],       255, false, 'action')       : null,
        substr(client_ip(), 0, 45),
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        isset($b['meta']) ? substr(json_encode($b['meta']), 0, 5000) : null,
    ]);

    respond(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
}

// ── GET /api/audit/stats ── Counts pro type ──────────────────
if ($method === 'GET' && $sub === 'stats') {
    require_auth();
    $sinceDays = isset($_GET['days']) ? max(1, min(365, (int)$_GET['days'])) : 30;
    $stmt = db()->prepare(
        'SELECT type, COUNT(*) AS cnt
         FROM audit_log
         WHERE ts >= (NOW() - INTERVAL ? DAY)
         GROUP BY type
         ORDER BY cnt DESC'
    );
    $stmt->execute([$sinceDays]);
    respond([
        'window_days' => $sinceDays,
        'counts'      => array_map(fn($r) => ['type' => $r['type'], 'cnt' => (int)$r['cnt']], $stmt->fetchAll()),
    ]);
}

// ── DELETE /api/audit/purge ── alte Einträge weg (Ausbilder) ─
if ($method === 'DELETE' && $sub === 'purge') {
    require_role('ausbilder');
    $days = isset($_GET['olderThan']) ? max(30, (int)$_GET['olderThan']) : 365;
    $stmt = db()->prepare('DELETE FROM audit_log WHERE ts < (NOW() - INTERVAL ? DAY)');
    $stmt->execute([$days]);
    respond(['deleted' => $stmt->rowCount()]);
}

// ── GET /api/audit ── Liste mit Filtern ──────────────────────
if ($method === 'GET' && !$sub) {
    $auth = require_auth();
    $limit  = isset($_GET['limit'])  ? max(1, min(500, (int)$_GET['limit']))  : 100;
    $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

    $where  = [];
    $params = [];
    // Azubis sehen nur ihre eigenen Einträge
    if (($auth['role'] ?? '') !== 'ausbilder') {
        $where[]  = 'user_id = ?';
        $params[] = (int)$auth['sub'];
    } elseif (!empty($_GET['user_id'])) {
        $where[]  = 'user_id = ?';
        $params[] = (int)$_GET['user_id'];
    }
    if (!empty($_GET['type'])) {
        $where[]  = 'type = ?';
        $params[] = clean_str($_GET['type'], 64, true, 'type');
    }
    if (!empty($_GET['since'])) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['since'])) error('since: ungültiges Datum', 400);
        $where[]  = 'ts >= ?';
        $params[] = $_GET['since'] . ' 00:00:00';
    }
    if (!empty($_GET['until'])) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['until'])) error('until: ungültiges Datum', 400);
        $where[]  = 'ts <= ?';
        $params[] = $_GET['until'] . ' 23:59:59';
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // Count + Page in einem Roundtrip
    $countSql = "SELECT COUNT(*) FROM audit_log $whereSql";
    $cnt = db()->prepare($countSql);
    $cnt->execute($params);
    $total = (int)$cnt->fetchColumn();

    $listSql = "SELECT id, ts, user_id, user_name, user_role, type,
                       entity_type, entity_id, entity_title,
                       project_id, project_title, action
                FROM audit_log $whereSql
                ORDER BY ts DESC, id DESC
                LIMIT $limit OFFSET $offset";
    $list = db()->prepare($listSql);
    $list->execute($params);
    $items = array_map(function($r) {
        $r['id']      = (int)$r['id'];
        $r['user_id'] = (int)$r['user_id'];
        return $r;
    }, $list->fetchAll());

    respond([
        'total'  => $total,
        'limit'  => $limit,
        'offset' => $offset,
        'items'  => $items,
    ]);
}

error('Methode nicht erlaubt', 405);
