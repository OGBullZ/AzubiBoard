<?php
// ============================================================
//  Migration-Helpers — extrahiert aus migrate_blob_to_relational.php
//  damit PHPUnit die Funktionen ohne Side-Effects testen kann.
//
//  Diese Datei darf KEINE Top-Level-Side-Effects haben.
//  Nur Funktions-Definitionen.
// ============================================================

declare(strict_types=1);

if (!function_exists('mapped_id')) {
    function mapped_id(PDO $pdo, string $type, string $blobId): ?int {
        $s = $pdo->prepare('SELECT rel_id FROM migration_blob_id_map WHERE entity_type=? AND blob_id=?');
        $s->execute([$type, $blobId]);
        $r = $s->fetchColumn();
        return $r !== false ? (int)$r : null;
    }
}

if (!function_exists('register_map')) {
    function register_map(PDO $pdo, string $type, string $blobId, int $relId): void {
        $pdo->prepare('INSERT IGNORE INTO migration_blob_id_map (entity_type, blob_id, rel_id) VALUES (?,?,?)')
            ->execute([$type, $blobId, $relId]);
    }
}

if (!function_exists('resolve_user')) {
    function resolve_user(PDO $pdo, mixed $blobUserId): ?int {
        if (!$blobUserId) return null;
        $id = (int)$blobUserId;
        if ($id <= 0) return null;
        $s = $pdo->prepare('SELECT id FROM users WHERE id=? LIMIT 1');
        $s->execute([$id]);
        $r = $s->fetchColumn();
        return $r !== false ? (int)$r : null;
    }
}

if (!function_exists('safe_date')) {
    /**
     * Konvertiert einen Datums-String zu Y-m-d.
     * Bei ungültigem Input wird null zurückgegeben UND ein error_log()-Eintrag geschrieben
     * (P0-6 Bugfix: silent drops sind data-loss).
     */
    function safe_date(?string $d, ?string $context = null): ?string {
        if (!$d) return null;
        $t = strtotime($d);
        if (!$t) {
            error_log(sprintf('[migration] safe_date drop: input=%s context=%s', $d, $context ?? '-'));
            return null;
        }
        return date('Y-m-d', $t);
    }
}

if (!function_exists('safe_ts')) {
    /**
     * Konvertiert einen Timestamp-String zu Y-m-d H:i:s.
     * Bei ungültigem Input wird null zurückgegeben + error_log (P0-6).
     */
    function safe_ts(?string $d, ?string $context = null): ?string {
        if (!$d) return null;
        $t = strtotime($d);
        if (!$t) {
            error_log(sprintf('[migration] safe_ts drop: input=%s context=%s', $d, $context ?? '-'));
            return null;
        }
        return date('Y-m-d H:i:s', $t);
    }
}

if (!function_exists('migration_status_or_default')) {
    /**
     * Validiert einen ENUM-Wert gegen eine erlaubte Liste. Bei Mismatch wird der Default zurückgegeben.
     * Beispiel: migration_status_or_default($p['status'], ['green','yellow','red'], 'yellow')
     */
    function migration_status_or_default(mixed $value, array $allowed, string $default): string {
        return in_array($value, $allowed, true) ? (string)$value : $default;
    }
}

if (!function_exists('migration_check_required_tables')) {
    /**
     * Pre-Flight (P0-6): prüft dass alle Migrations-Ziel-Tabellen existieren.
     * Wirft RuntimeException mit klarer Fehlermeldung wenn nicht.
     */
    function migration_check_required_tables(PDO $pdo, array $tables): void {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        // Driver-spezifisch — MySQL/MariaDB nutzen SHOW TABLES, SQLite (für Tests) sqlite_master.
        $sql = $driver === 'sqlite'
            ? "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
            : "SHOW TABLES LIKE ?";

        foreach ($tables as $t) {
            $s = $pdo->prepare($sql);
            $s->execute([$t]);
            if ($s->fetch() === false) {
                throw new RuntimeException(sprintf(
                    "Migration kann nicht starten: Tabelle '%s' existiert nicht. "
                    . "Erst `database/azubiboard.sql` und `database/setup.sql` importieren.",
                    $t
                ));
            }
        }
    }
}

if (!function_exists('apply_phase2_schema')) {
    /**
     * Sprint 12 Phase 2 — Schema-Erweiterung idempotent anwenden.
     *
     * Driver-aware: MariaDB nutzt die kanonische sprint12_phase2.sql,
     * SQLite (Tests) bekommt eine portierte Variante ohne FK-Constraints
     * gegen MySQL-Spezifika.
     *
     * Source-of-truth für Produktion: database/migrations/sprint12_phase2.sql
     * Diese Funktion existiert primär, damit PHPUnit-Tests gegen In-Memory-SQLite
     * fahren können — Produktion sollte mysql < sprint12_phase2.sql nutzen.
     *
     * @return string[] Liste der ausgeführten DDL-Schritte (für Logging)
     */
    function apply_phase2_schema(PDO $pdo): array {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $log = [];

        $exec = function(string $sql, string $label) use ($pdo, &$log): void {
            try {
                $pdo->exec($sql);
                $log[] = "OK: $label";
            } catch (PDOException $e) {
                // Idempotenz: "already exists" / "duplicate column" tolerieren.
                $msg = $e->getMessage();
                $ignorable = preg_match('/already exists|duplicate column|duplicate key name/i', $msg);
                if ($ignorable) {
                    $log[] = "SKIP: $label (already applied)";
                } else {
                    throw $e;
                }
            }
        };

        // ---- learning_paths ----
        if ($driver === 'sqlite') {
            $exec("CREATE TABLE IF NOT EXISTS learning_paths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_by INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                lehrjahr INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )", 'learning_paths');
            $exec("CREATE TABLE IF NOT EXISTS learning_path_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path_id INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL DEFAULT 'article' CHECK (type IN ('article','link','quiz','task')),
                content TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )", 'learning_path_nodes');
            $exec("CREATE TABLE IF NOT EXISTS learning_path_edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path_id INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
                from_node INTEGER NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
                to_node INTEGER NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
                UNIQUE(path_id, from_node, to_node)
            )", 'learning_path_edges');
            $exec("CREATE TABLE IF NOT EXISTS learning_path_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                node_id INTEGER NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                UNIQUE(user_id, node_id)
            )", 'learning_path_progress');
        } else {
            // MariaDB/MySQL — exakt die Statements aus sprint12_phase2.sql.
            $exec("CREATE TABLE IF NOT EXISTS `learning_paths` (
                `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `created_by` int(10) UNSIGNED DEFAULT NULL,
                `title` varchar(255) NOT NULL,
                `description` text DEFAULT NULL,
                `lehrjahr` tinyint(3) UNSIGNED DEFAULT NULL,
                `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
                `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                PRIMARY KEY (`id`),
                KEY `idx_lp_lehrjahr` (`lehrjahr`),
                KEY `idx_lp_created_by` (`created_by`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci", 'learning_paths');
            $exec("CREATE TABLE IF NOT EXISTS `learning_path_nodes` (
                `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `path_id` int(10) UNSIGNED NOT NULL,
                `title` varchar(255) NOT NULL,
                `description` text DEFAULT NULL,
                `type` enum('article','link','quiz','task') NOT NULL DEFAULT 'article',
                `content` text DEFAULT NULL,
                `sort_order` smallint(5) UNSIGNED DEFAULT 0,
                `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
                `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                PRIMARY KEY (`id`),
                KEY `idx_lpn_path` (`path_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci", 'learning_path_nodes');
            $exec("CREATE TABLE IF NOT EXISTS `learning_path_edges` (
                `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `path_id` int(10) UNSIGNED NOT NULL,
                `from_node` int(10) UNSIGNED NOT NULL,
                `to_node` int(10) UNSIGNED NOT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_lp_edge` (`path_id`,`from_node`,`to_node`),
                KEY `idx_lpe_from` (`from_node`),
                KEY `idx_lpe_to` (`to_node`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci", 'learning_path_edges');
            $exec("CREATE TABLE IF NOT EXISTS `learning_path_progress` (
                `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `user_id` int(10) UNSIGNED NOT NULL,
                `node_id` int(10) UNSIGNED NOT NULL,
                `completed` tinyint(1) NOT NULL DEFAULT 0,
                `completed_at` timestamp NULL DEFAULT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_lpp_user_node` (`user_id`,`node_id`),
                KEY `idx_lpp_node` (`node_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci", 'learning_path_progress');
        }

        // ---- Soft-Delete ----
        foreach (['projects', 'reports', 'requirements'] as $tbl) {
            if ($driver === 'sqlite') {
                if (!_phase2_sqlite_column_exists($pdo, $tbl, 'deleted_at')) {
                    $exec("ALTER TABLE $tbl ADD COLUMN deleted_at TEXT", "$tbl.deleted_at");
                } else {
                    $log[] = "SKIP: $tbl.deleted_at (already applied)";
                }
            } else {
                $exec("ALTER TABLE `$tbl` ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL", "$tbl.deleted_at");
                $exec("ALTER TABLE `$tbl` ADD INDEX `idx_{$tbl}_deleted` (`deleted_at`)", "$tbl idx_deleted");
            }
        }

        // ---- users.training_plan ----
        if ($driver === 'sqlite') {
            if (!_phase2_sqlite_column_exists($pdo, 'users', 'training_plan')) {
                $exec("ALTER TABLE users ADD COLUMN training_plan TEXT", 'users.training_plan');
            } else {
                $log[] = 'SKIP: users.training_plan (already applied)';
            }
        } else {
            $exec("ALTER TABLE `users` ADD COLUMN `training_plan` JSON DEFAULT NULL", 'users.training_plan');
        }

        return $log;
    }
}

if (!function_exists('_phase2_sqlite_column_exists')) {
    function _phase2_sqlite_column_exists(PDO $pdo, string $table, string $column): bool {
        $s = $pdo->query("PRAGMA table_info($table)");
        foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $col) {
            if ($col['name'] === $column) return true;
        }
        return false;
    }
}

if (!function_exists('resolve_group_for_user')) {
    /**
     * P0-6 Fix: holt die erste Gruppe (Lerngruppe bevorzugt) eines Users für group_id-Mapping.
     * Vorher wurde group_id immer NULL gesetzt → RLS-Bruch für Gruppen-Mitglieder.
     */
    function resolve_group_for_user(PDO $pdo, ?int $userId): ?int {
        if (!$userId) return null;
        $s = $pdo->prepare("
            SELECT g.id FROM groups g
            INNER JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = ?
            ORDER BY (g.type = 'lerngruppe') DESC, g.id ASC
            LIMIT 1
        ");
        $s->execute([$userId]);
        $r = $s->fetchColumn();
        return $r !== false ? (int)$r : null;
    }
}
