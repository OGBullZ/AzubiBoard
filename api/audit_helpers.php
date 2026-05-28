<?php
// ============================================================
//  audit_helpers.php — Audit-Log-Helper (K5 / Sprint 12 L5-6b)
//
//  Side-effect-frei (nur Funktions-Definitionen), damit Routes (via
//  config.php) UND PHPUnit es laden können.
//
//  - audit_ensure_table: driver-aware DDL (MySQL prod + SQLite Tests),
//    single source-of-truth für das audit_log-Schema (audit.php + Dual-Write).
//  - audit_log_write: fire-and-forget INSERT für vertrauenswürdige interne
//    Aufrufer (z. B. Dual-Write). Wirft NIE — ein fehlender Audit-Eintrag
//    darf den eigentlichen Vorgang nicht brechen.
// ============================================================

declare(strict_types=1);

if (!function_exists('audit_ensure_table')) {
    function audit_ensure_table(PDO $pdo): void {
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER NOT NULL, user_name TEXT, user_role TEXT,
                type TEXT NOT NULL, entity_type TEXT, entity_id TEXT, entity_title TEXT,
                project_id TEXT, project_title TEXT, action TEXT, ip TEXT, ua TEXT, meta TEXT
            )");
            return;
        }
        $pdo->exec("
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
    }
}

if (!function_exists('audit_log_write')) {
    /**
     * @param array $user   JWT-Payload (erwartet 'sub'; 'name'/'role' optional)
     * @param array $fields optionale Felder: entity_type, entity_id, entity_title,
     *                      project_id, project_title, action, ip, ua, meta (array→json)
     * @return bool true wenn geschrieben, false bei Fehler (geloggt, nie geworfen)
     */
    function audit_log_write(PDO $pdo, array $user, string $type, array $fields = []): bool {
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO audit_log
                 (user_id, user_name, user_role, type, entity_type, entity_id, entity_title,
                  project_id, project_title, action, ip, ua, meta)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                (int)($user['sub'] ?? 0),
                $user['name'] ?? null,
                $user['role'] ?? null,
                $type,
                $fields['entity_type']   ?? null,
                $fields['entity_id']     ?? null,
                $fields['entity_title']  ?? null,
                $fields['project_id']    ?? null,
                $fields['project_title'] ?? null,
                $fields['action']        ?? null,
                $fields['ip']            ?? null,
                $fields['ua']            ?? null,
                isset($fields['meta']) ? substr(json_encode($fields['meta'], JSON_UNESCAPED_UNICODE), 0, 5000) : null,
            ]);
            return true;
        } catch (\Throwable $e) {
            error_log('[audit] write failed (' . $type . '): ' . $e->getMessage());
            return false;
        }
    }
}
