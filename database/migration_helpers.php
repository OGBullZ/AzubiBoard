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
        // Driver-aware INSERT-IGNORE: MySQL hat "INSERT IGNORE", SQLite "INSERT OR IGNORE".
        $verb = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? 'INSERT OR IGNORE'
            : 'INSERT IGNORE';
        $pdo->prepare("$verb INTO migration_blob_id_map (entity_type, blob_id, rel_id) VALUES (?,?,?)")
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

if (!function_exists('migration_insert_ignore_verb')) {
    /**
     * Driver-aware INSERT-IGNORE-Prefix.
     * MySQL/MariaDB: "INSERT IGNORE"   →  ignoriert UNIQUE-Violations
     * SQLite:        "INSERT OR IGNORE" →  selbe Semantik
     */
    function migration_insert_ignore_verb(PDO $pdo): string {
        return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? 'INSERT OR IGNORE'
            : 'INSERT IGNORE';
    }
}

// ============================================================
//  P2-2: migrate_* Funktionen pro Entität.
//
//  Jede Funktion ist idempotent über migration_blob_id_map ODER
//  über natürliche UNIQUE-Constraints (Edges/Progress).
//  Alle Funktionen sind PDO-driver-agnostisch (MySQL+SQLite) damit
//  PHPUnit-Tests in-memory laufen können.
// ============================================================

if (!function_exists('migrate_quizzes')) {
    /**
     * `data.quizzes[]` → `quizzes` + `quiz_questions` + `quiz_answers`.
     * Idempotent via migration_blob_id_map (entity_type: quiz/quiz_question/quiz_answer).
     * Answer-Keys: "{question_blob_id}:answer:{i}" (Fixture liefert keine Answer-IDs).
     */
    function migrate_quizzes(PDO $pdo, array $quizzes, bool $dryRun = false): array {
        $stats = ['quizzes' => 0, 'quiz_questions' => 0, 'quiz_answers' => 0, 'skipped' => 0];
        foreach ($quizzes as $q) {
            $blobId = (string)($q['id'] ?? '');
            if (!$blobId) { $stats['skipped']++; continue; }
            if (mapped_id($pdo, 'quiz', $blobId)) { $stats['skipped']++; continue; }

            $createdBy = resolve_user($pdo, $q['created_by'] ?? $q['user_id'] ?? null);
            if (!$createdBy) { $stats['skipped']++; continue; }

            $title = trim((string)($q['title'] ?? ''));
            if (!$title) { $stats['skipped']++; continue; }

            $difficulty = migration_status_or_default($q['difficulty'] ?? null, ['easy','medium','hard'], 'medium');

            $relQuizId = 0;
            if (!$dryRun) {
                $pdo->beginTransaction();
                try {
                    $stmt = $pdo->prepare(
                        "INSERT INTO quizzes (created_by, title, description, difficulty, time_limit_sec, is_public)
                         VALUES (?,?,?,?,?,?)"
                    );
                    $stmt->execute([
                        $createdBy,
                        $title,
                        $q['description'] ?? null,
                        $difficulty,
                        !empty($q['time_limit_sec']) ? (int)$q['time_limit_sec'] : null,
                        !empty($q['is_public']) || !isset($q['is_public']) ? 1 : 0,
                    ]);
                    $relQuizId = (int)$pdo->lastInsertId();
                    register_map($pdo, 'quiz', $blobId, $relQuizId);

                    foreach ($q['questions'] ?? [] as $qi => $question) {
                        $qBlobId = (string)($question['id'] ?? "{$blobId}:q:{$qi}");
                        if (mapped_id($pdo, 'quiz_question', $qBlobId)) { $stats['skipped']++; continue; }
                        $qText = trim((string)($question['text'] ?? $question['question_text'] ?? ''));
                        if (!$qText) { $stats['skipped']++; continue; }
                        $qType = migration_status_or_default($question['type'] ?? null, ['single','multiple','text'], 'single');

                        $stmt = $pdo->prepare(
                            "INSERT INTO quiz_questions (quiz_id, question_text, question_type, explanation, points, sort_order)
                             VALUES (?,?,?,?,?,?)"
                        );
                        $stmt->execute([
                            $relQuizId,
                            $qText,
                            $qType,
                            $question['explanation'] ?? null,
                            isset($question['points']) ? max(1, (int)$question['points']) : 1,
                            $qi,
                        ]);
                        $relQuestionId = (int)$pdo->lastInsertId();
                        register_map($pdo, 'quiz_question', $qBlobId, $relQuestionId);
                        $stats['quiz_questions']++;

                        foreach ($question['answers'] ?? [] as $ai => $answer) {
                            $aBlobId = "{$qBlobId}:answer:{$ai}";
                            if (mapped_id($pdo, 'quiz_answer', $aBlobId)) { $stats['skipped']++; continue; }
                            $aText = trim((string)($answer['text'] ?? $answer['answer_text'] ?? ''));
                            if ($aText === '') { $stats['skipped']++; continue; }
                            $stmt = $pdo->prepare(
                                "INSERT INTO quiz_answers (question_id, answer_text, is_correct, sort_order)
                                 VALUES (?,?,?,?)"
                            );
                            $stmt->execute([
                                $relQuestionId,
                                $aText,
                                !empty($answer['correct']) || !empty($answer['is_correct']) ? 1 : 0,
                                $ai,
                            ]);
                            register_map($pdo, 'quiz_answer', $aBlobId, (int)$pdo->lastInsertId());
                            $stats['quiz_answers']++;
                        }
                    }
                    $pdo->commit();
                } catch (\Throwable $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    error_log("[migration] migrate_quizzes rollback for quiz:{$blobId}: " . $e->getMessage());
                    $stats['skipped']++;
                    continue;
                }
            }
            $stats['quizzes']++;
        }
        return $stats;
    }
}

if (!function_exists('migrate_learning_paths')) {
    /**
     * `data.learningPaths[]` + `data.pathProgress` → 4 P2-1-Tabellen.
     * Edges aus node.prerequisites[] (jeder Prereq → Edge from→to).
     * Progress: nur "done" wird übernommen (completed=1, completed_at=now).
     *           "in_progress"/"locked" werden NICHT als Progress-Row angelegt
     *           (Progress repräsentiert Abschluss, nicht Status).
     */
    function migrate_learning_paths(PDO $pdo, array $paths, array $progress, bool $dryRun = false): array {
        $stats = [
            'learning_paths' => 0, 'learning_path_nodes' => 0,
            'learning_path_edges' => 0, 'learning_path_progress' => 0,
            'skipped' => 0,
        ];
        $ignoreVerb = migration_insert_ignore_verb($pdo);

        foreach ($paths as $p) {
            $blobId = (string)($p['id'] ?? '');
            if (!$blobId) { $stats['skipped']++; continue; }
            if (mapped_id($pdo, 'learning_path', $blobId)) { $stats['skipped']++; continue; }

            $title = trim((string)($p['title'] ?? ''));
            if (!$title) { $stats['skipped']++; continue; }

            $createdBy = resolve_user($pdo, $p['created_by'] ?? $p['user_id'] ?? null);

            if (!$dryRun) {
                $pdo->beginTransaction();
                try {
                    $stmt = $pdo->prepare(
                        "INSERT INTO learning_paths (created_by, title, description, lehrjahr)
                         VALUES (?,?,?,?)"
                    );
                    $stmt->execute([
                        $createdBy,
                        $title,
                        $p['description'] ?? null,
                        !empty($p['lehrjahr']) ? (int)$p['lehrjahr'] : null,
                    ]);
                    $relPathId = (int)$pdo->lastInsertId();
                    register_map($pdo, 'learning_path', $blobId, $relPathId);

                    // Pass 1: Nodes anlegen, blobId→relId merken (für Edges)
                    foreach ($p['nodes'] ?? [] as $ni => $node) {
                        $nBlobId = (string)($node['id'] ?? "{$blobId}:node:{$ni}");
                        if (mapped_id($pdo, 'learning_path_node', $nBlobId)) { $stats['skipped']++; continue; }
                        $nTitle = trim((string)($node['title'] ?? ''));
                        if (!$nTitle) { $stats['skipped']++; continue; }
                        $nType = migration_status_or_default($node['type'] ?? null, ['article','link','quiz','task'], 'article');

                        $stmt = $pdo->prepare(
                            "INSERT INTO learning_path_nodes (path_id, title, description, type, content, sort_order)
                             VALUES (?,?,?,?,?,?)"
                        );
                        $stmt->execute([
                            $relPathId,
                            $nTitle,
                            $node['description'] ?? null,
                            $nType,
                            $node['content'] ?? null,
                            $ni,
                        ]);
                        register_map($pdo, 'learning_path_node', $nBlobId, (int)$pdo->lastInsertId());
                        $stats['learning_path_nodes']++;
                    }

                    // Pass 2: Edges aus prerequisites
                    foreach ($p['nodes'] ?? [] as $node) {
                        $toBlobId = (string)($node['id'] ?? '');
                        if (!$toBlobId) continue;
                        $toRelId = mapped_id($pdo, 'learning_path_node', $toBlobId);
                        if (!$toRelId) continue;
                        foreach ($node['prerequisites'] ?? [] as $preBlobId) {
                            $fromRelId = mapped_id($pdo, 'learning_path_node', (string)$preBlobId);
                            if (!$fromRelId) continue;
                            $stmt = $pdo->prepare(
                                "$ignoreVerb INTO learning_path_edges (path_id, from_node, to_node)
                                 VALUES (?,?,?)"
                            );
                            $stmt->execute([$relPathId, $fromRelId, $toRelId]);
                            if ($stmt->rowCount() > 0) $stats['learning_path_edges']++;
                        }
                    }

                    $pdo->commit();
                } catch (\Throwable $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    error_log("[migration] migrate_learning_paths rollback for path:{$blobId}: " . $e->getMessage());
                    $stats['skipped']++;
                    continue;
                }
            }
            $stats['learning_paths']++;
        }

        // Progress (separat, da pathProgress global ist) — nur "done" wird übernommen.
        if (!$dryRun) {
            foreach ($progress as $pathBlobId => $nodes) {
                if (!is_array($nodes)) continue;
                foreach ($nodes as $nodeBlobId => $state) {
                    if ($state !== 'done') continue;
                    $nodeRelId = mapped_id($pdo, 'learning_path_node', (string)$nodeBlobId);
                    if (!$nodeRelId) continue;
                    // Progress ist user-spezifisch — Blob hat keinen User, deshalb
                    // alle Azubi-Rollen mit done markieren. In Praxis ist das
                    // typischerweise 1 User (Single-Azubi-Setup).
                    $users = $pdo->query("SELECT id FROM users WHERE role IN ('azubi','mentor','ausbilder')")
                        ->fetchAll(PDO::FETCH_COLUMN);
                    if (!$users) $users = $pdo->query("SELECT id FROM users")->fetchAll(PDO::FETCH_COLUMN);
                    foreach ($users as $uid) {
                        $stmt = $pdo->prepare(
                            "$ignoreVerb INTO learning_path_progress (user_id, node_id, completed, completed_at)
                             VALUES (?,?,1, " . ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
                                ? "datetime('now')"
                                : "CURRENT_TIMESTAMP") . ")"
                        );
                        $stmt->execute([(int)$uid, $nodeRelId]);
                        if ($stmt->rowCount() > 0) $stats['learning_path_progress']++;
                    }
                }
            }
        }

        return $stats;
    }
}

if (!function_exists('migrate_calendar_events')) {
    /**
     * `data.calendarEvents[]` → `calendar_events`.
     * Idempotent via migration_blob_id_map (entity_type: calendar_event).
     */
    function migrate_calendar_events(PDO $pdo, array $events, bool $dryRun = false): array {
        $stats = ['calendar_events' => 0, 'skipped' => 0];
        foreach ($events as $ev) {
            $blobId = (string)($ev['id'] ?? '');
            if (!$blobId) { $stats['skipped']++; continue; }
            if (mapped_id($pdo, 'calendar_event', $blobId)) { $stats['skipped']++; continue; }

            $userId = resolve_user($pdo, $ev['user_id'] ?? null);
            if (!$userId) { $stats['skipped']++; continue; }

            $title = trim((string)($ev['title'] ?? ''));
            $eventDate = safe_date($ev['event_date'] ?? $ev['date'] ?? null, "calendar_event:{$blobId}.event_date");
            if (!$title || !$eventDate) { $stats['skipped']++; continue; }

            $type = migration_status_or_default($ev['type'] ?? null, ['event','deadline','reminder','untis','holiday'], 'event');

            if (!$dryRun) {
                $stmt = $pdo->prepare(
                    "INSERT INTO calendar_events
                        (user_id, project_id, title, description, event_date, start_time, end_time,
                         all_day, type, color, source, external_id)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
                );
                $stmt->execute([
                    $userId,
                    !empty($ev['project_id']) ? (int)$ev['project_id'] : null,
                    $title,
                    $ev['description'] ?? null,
                    $eventDate,
                    $ev['start_time'] ?? null,
                    $ev['end_time'] ?? null,
                    !empty($ev['all_day']) || empty($ev['start_time']) ? 1 : 0,
                    $type,
                    $ev['color'] ?? null,
                    $ev['source'] ?? 'manual',
                    $ev['external_id'] ?? null,
                ]);
                register_map($pdo, 'calendar_event', $blobId, (int)$pdo->lastInsertId());
            }
            $stats['calendar_events']++;
        }
        return $stats;
    }
}

if (!function_exists('migrate_training_plan')) {
    /**
     * `data.trainingPlan` (global Single-Object) → `users.training_plan` JSON.
     * Wird auf ALLE Azubi-User geschrieben (Single-Tenant-Setup üblich).
     * Idempotent über entity_type='training_plan' mit blob_id='global'.
     */
    function migrate_training_plan(PDO $pdo, ?array $plan, bool $dryRun = false): array {
        $stats = ['training_plan_users' => 0, 'skipped' => 0];
        if (!$plan) { $stats['skipped']++; return $stats; }
        if (mapped_id($pdo, 'training_plan', 'global')) { $stats['skipped']++; return $stats; }

        if (!$dryRun) {
            $azubis = $pdo->query("SELECT id FROM users WHERE role = 'azubi'")->fetchAll(PDO::FETCH_COLUMN);
            if (!$azubis) {
                // Fallback: kein Azubi → 1. User (Single-User-Setup ohne Rollen)
                $azubis = $pdo->query("SELECT id FROM users ORDER BY id ASC LIMIT 1")->fetchAll(PDO::FETCH_COLUMN);
            }
            $json = json_encode($plan, JSON_UNESCAPED_UNICODE);
            foreach ($azubis as $uid) {
                $pdo->prepare("UPDATE users SET training_plan = ? WHERE id = ?")
                    ->execute([$json, (int)$uid]);
                $stats['training_plan_users']++;
            }
            // Marker: einmal pro Migration anwenden
            register_map($pdo, 'training_plan', 'global', 1);
        }
        return $stats;
    }
}

if (!function_exists('migrate_time_entries_for_task')) {
    /**
     * Inline `task.timeLog[]` → `time_entries` (pro Task).
     * Wird aus dem Task-Loop heraus aufgerufen, nachdem der Task gemappt ist.
     * Keine eigene Blob-ID → Key "task:{blobTaskId}:tl:{i}" für Idempotenz.
     */
    function migrate_time_entries_for_task(
        PDO $pdo,
        int $relTaskId,
        int $relProjectId,
        ?int $userId,
        string $blobTaskId,
        array $timeLog,
        bool $dryRun = false
    ): int {
        if (!$userId) return 0;
        $count = 0;
        foreach ($timeLog as $i => $entry) {
            $key = "task:{$blobTaskId}:tl:{$i}";
            if (mapped_id($pdo, 'time_entry', $key)) continue;

            $start = safe_ts($entry['start'] ?? $entry['started_at'] ?? null, "$key.start");
            $end   = safe_ts($entry['end']   ?? $entry['ended_at']   ?? null, "$key.end");
            if (!$start) continue;

            if (!$dryRun) {
                $stmt = $pdo->prepare(
                    "INSERT INTO time_entries (project_id, task_id, user_id, description, started_at, ended_at)
                     VALUES (?,?,?,?,?,?)"
                );
                $stmt->execute([
                    $relProjectId, $relTaskId, $userId,
                    $entry['description'] ?? null,
                    $start, $end,
                ]);
                register_map($pdo, 'time_entry', $key, (int)$pdo->lastInsertId());
            }
            $count++;
        }
        return $count;
    }
}

if (!function_exists('migrate_report_file')) {
    /**
     * Inline `report.file` (string ODER {url,path}) → `report_files`.
     * Wird aus dem Report-Loop heraus aufgerufen, nachdem der Report gemappt ist.
     * Key "report:{blobReportId}:file" für Idempotenz (1 File pro Report).
     */
    function migrate_report_file(
        PDO $pdo,
        int $relReportId,
        int $userId,
        string $blobReportId,
        mixed $file,
        bool $dryRun = false
    ): int {
        if (!$file) return 0;
        $key = "report:{$blobReportId}:file";
        if (mapped_id($pdo, 'report_file', $key)) return 0;

        if (is_array($file)) {
            $path = $file['path'] ?? $file['url'] ?? null;
            $originalName = $file['original_name'] ?? $file['name'] ?? null;
            $mime = $file['mime_type'] ?? $file['mime'] ?? null;
            $size = !empty($file['file_size']) ? (int)$file['file_size'] : (!empty($file['size']) ? (int)$file['size'] : null);
        } else {
            $path = (string)$file;
            $originalName = null;
            $mime = null;
            $size = null;
        }
        if (!$path) return 0;

        $filename = basename($path);
        if (!$originalName) $originalName = $filename;

        if (!$dryRun) {
            $stmt = $pdo->prepare(
                "INSERT INTO report_files
                    (report_id, user_id, filename, original_name, file_path, file_size, mime_type, upload_type)
                 VALUES (?,?,?,?,?,?,?,'report')"
            );
            $stmt->execute([$relReportId, $userId, $filename, $originalName, $path, $size, $mime]);
            register_map($pdo, 'report_file', $key, (int)$pdo->lastInsertId());
        }
        return 1;
    }
}

if (!function_exists('migration_ensure_map_table')) {
    /**
     * Legt die Idempotenz-Mapping-Tabelle an, falls nicht vorhanden.
     * Driver-aware (MySQL/MariaDB + SQLite für Tests).
     */
    function migration_ensure_map_table(PDO $pdo): void {
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS migration_blob_id_map (
                entity_type TEXT NOT NULL, blob_id TEXT NOT NULL, rel_id INTEGER NOT NULL,
                PRIMARY KEY (entity_type, blob_id)
            )");
        } else {
            $pdo->exec("CREATE TABLE IF NOT EXISTS migration_blob_id_map (
                entity_type VARCHAR(50)  NOT NULL,
                blob_id     VARCHAR(100) NOT NULL,
                rel_id      INT UNSIGNED NOT NULL,
                migrated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (entity_type, blob_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }
}

if (!function_exists('migrate_projects')) {
    /**
     * `data.projects[]` → projects + tasks + requirements + materials (+ inline timeLog → time_entries).
     * Idempotent via migration_blob_id_map. Transaktion pro Projekt: alles-oder-nichts
     * (project + children), bei Fehler Rollback + skip, restliche Projekte laufen weiter.
     * Side-effect-frei (kein echo) — sowohl vom CLI-Script als auch vom Dual-Write genutzt.
     */
    function migrate_projects(PDO $pdo, array $projects, bool $dryRun = false): array {
        $stats = ['projects'=>0,'tasks'=>0,'requirements'=>0,'materials'=>0,'time_entries'=>0,'skipped'=>0];

        foreach ($projects as $p) {
            $blobProjId = (string)($p['id'] ?? '');
            if (!$blobProjId) continue;
            if (mapped_id($pdo, 'project', $blobProjId)) { $stats['skipped']++; continue; }

            $createdBy = resolve_user($pdo, $p['user_id'] ?? $p['created_by'] ?? null);
            $title     = trim((string)($p['title'] ?? $p['name'] ?? 'Unbenanntes Projekt'));
            $status    = migration_status_or_default($p['status'] ?? null, ['green','yellow','red'], 'yellow');
            $priority  = migration_status_or_default($p['priority'] ?? null, ['low','medium','high','critical'], 'medium');
            $unit      = migration_status_or_default($p['netzplan_unit'] ?? null, ['W','T','M'], 'W');
            $archived  = !empty($p['archived']) ? 1 : 0;
            // group_id aus Gruppen-Mitgliedschaft des Erstellers (P0-6: vorher NULL → RLS-Bruch).
            $groupId   = resolve_group_for_user($pdo, $createdBy);

            // Lokale Zähler — werden erst nach erfolgreichem Commit in $stats gefaltet,
            // damit ein Rollback keine Halb-Counts hinterlässt.
            $local = ['tasks'=>0,'requirements'=>0,'materials'=>0,'time_entries'=>0];

            if (!$dryRun) $pdo->beginTransaction();
            try {
                $relProjId = 0;
                if (!$dryRun) {
                    $stmt = $pdo->prepare("
                        INSERT INTO projects
                            (group_id, created_by, title, description, status, priority,
                             start_date, deadline, netzplan_unit, color, archived)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $groupId, $createdBy, $title, $p['description'] ?? null, $status, $priority,
                        safe_date($p['start_date'] ?? null, "project:{$blobProjId}.start_date"),
                        safe_date($p['deadline']   ?? null, "project:{$blobProjId}.deadline"),
                        $unit, $p['color'] ?? null, $archived,
                    ]);
                    $relProjId = (int)$pdo->lastInsertId();
                    register_map($pdo, 'project', $blobProjId, $relProjId);

                    if ($createdBy) {
                        $ignoreVerb = migration_insert_ignore_verb($pdo);
                        $pdo->prepare("$ignoreVerb INTO project_assignments (project_id, user_id, assigned_by) VALUES (?,?,?)")
                            ->execute([$relProjId, $createdBy, $createdBy]);
                    }
                }

                // ── Tasks ──
                foreach ($p['tasks'] ?? [] as $t) {
                    $blobTaskId = (string)($t['id'] ?? '');
                    if (!$blobTaskId) continue;
                    if (mapped_id($pdo, 'task', $blobTaskId)) { $stats['skipped']++; continue; }

                    $taskTitle = trim((string)($t['text'] ?? $t['title'] ?? ''));
                    if (!$taskTitle) continue;

                    $done = !empty($t['done']);
                    $rawStatus  = $t['status'] ?? ($done ? 'done' : 'open');
                    $taskStatus = migration_status_or_default($rawStatus, ['open','in_progress','done','blocked','waiting'], $done ? 'done' : 'open');
                    $taskPrio   = migration_status_or_default($t['priority'] ?? null, ['low','medium','high'], 'medium');
                    $assignedTo = resolve_user($pdo, $t['assigned_to'] ?? null);

                    if (!$dryRun && $relProjId) {
                        $stmt = $pdo->prepare("
                            INSERT INTO tasks
                                (project_id, assigned_to, created_by, title, description, note, doc, protocol,
                                 status, priority, due_date, estimated_minutes, completed_at)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                        ");
                        $completedAt = ($taskStatus === 'done' && !empty($t['completed_at']))
                            ? safe_ts($t['completed_at'], "task:{$blobTaskId}.completed_at") : null;
                        $stmt->execute([
                            $relProjId, $assignedTo, $createdBy, $taskTitle,
                            $t['description'] ?? null, $t['note'] ?? null, $t['doc'] ?? null, $t['protocol'] ?? null,
                            $taskStatus, $taskPrio,
                            safe_date($t['due_date'] ?? null, "task:{$blobTaskId}.due_date"),
                            !empty($t['estimated_minutes']) ? (int)$t['estimated_minutes'] : null,
                            $completedAt,
                        ]);
                        $relTaskId = (int)$pdo->lastInsertId();
                        register_map($pdo, 'task', $blobTaskId, $relTaskId);

                        if (!empty($t['timeLog']) && is_array($t['timeLog'])) {
                            $tlOwner = $assignedTo ?: $createdBy;
                            $local['time_entries'] += migrate_time_entries_for_task(
                                $pdo, $relTaskId, $relProjId, $tlOwner, $blobTaskId, $t['timeLog'], $dryRun
                            );
                        }
                    }
                    $local['tasks']++;
                }

                // ── Requirements ──
                foreach ($p['requirements'] ?? [] as $i => $r) {
                    $blobReqId = (string)($r['id'] ?? "req_{$blobProjId}_{$i}");
                    if (mapped_id($pdo, 'requirement', $blobReqId)) { $stats['skipped']++; continue; }

                    $reqTitle = trim((string)($r['title'] ?? $r['text'] ?? ''));
                    if (!$reqTitle) continue;
                    $prio = migration_status_or_default($r['priority'] ?? null, ['must','should','could'], 'must');

                    if (!$dryRun && $relProjId) {
                        $stmt = $pdo->prepare("
                            INSERT INTO requirements (project_id, title, description, done, priority, sort_order, completed_at)
                            VALUES (?,?,?,?,?,?,?)
                        ");
                        $stmt->execute([
                            $relProjId, $reqTitle, $r['description'] ?? null,
                            !empty($r['done']) ? 1 : 0, $prio, $i,
                            !empty($r['done']) ? safe_ts($r['completed_at'] ?? date('Y-m-d H:i:s'), "req:{$blobReqId}.completed_at") : null,
                        ]);
                        register_map($pdo, 'requirement', $blobReqId, (int)$pdo->lastInsertId());
                    }
                    $local['requirements']++;
                }

                // ── Materials ──
                foreach ($p['materials'] ?? [] as $i => $m) {
                    $blobMatId = (string)($m['id'] ?? "mat_{$blobProjId}_{$i}");
                    if (mapped_id($pdo, 'material', $blobMatId)) { $stats['skipped']++; continue; }

                    $matName = trim((string)($m['name'] ?? ''));
                    if (!$matName) continue;

                    if (!$dryRun && $relProjId) {
                        $stmt = $pdo->prepare("
                            INSERT INTO materials
                                (project_id, name, description, quantity, unit, unit_cost, supplier, ordered, sort_order)
                            VALUES (?,?,?,?,?,?,?,?,?)
                        ");
                        $stmt->execute([
                            $relProjId, $matName, $m['description'] ?? null,
                            max(0.01, (float)($m['quantity'] ?? 1)), $m['unit'] ?? 'Stück',
                            max(0, (float)($m['unit_cost'] ?? 0)), $m['supplier'] ?? null,
                            !empty($m['ordered']) ? 1 : 0, $i,
                        ]);
                        register_map($pdo, 'material', $blobMatId, (int)$pdo->lastInsertId());
                    }
                    $local['materials']++;
                }

                if (!$dryRun && $pdo->inTransaction()) $pdo->commit();
            } catch (\Throwable $e) {
                if (!$dryRun && $pdo->inTransaction()) $pdo->rollBack();
                error_log("[migration] migrate_projects rollback for project:{$blobProjId}: " . $e->getMessage());
                $stats['skipped']++;
                continue;
            }

            $stats['projects']++;
            foreach ($local as $k => $v) $stats[$k] += $v;
        }

        return $stats;
    }
}

if (!function_exists('migrate_reports')) {
    /**
     * `data.reports[]` → reports (+ inline file → report_files).
     * Idempotent via migration_blob_id_map. Pro Report eigene try/catch:
     * ein fehlerhafter Report blockiert die übrigen nicht (wichtig für Dual-Write).
     */
    function migrate_reports(PDO $pdo, array $reports, bool $dryRun = false): array {
        $stats = ['reports'=>0,'report_files'=>0,'skipped'=>0];

        foreach ($reports as $r) {
            $blobRepId = (string)($r['id'] ?? '');
            if (!$blobRepId) continue;
            if (mapped_id($pdo, 'report', $blobRepId)) { $stats['skipped']++; continue; }

            $userId = resolve_user($pdo, $r['user_id'] ?? null);
            if (!$userId) { $stats['skipped']++; continue; }

            $repStatus = migration_status_or_default($r['status'] ?? 'draft', ['draft','submitted','reviewed','signed'], 'draft');
            $weekStart = safe_date($r['week_start'] ?? null, "report:{$blobRepId}.week_start");
            if (!$weekStart) { $stats['skipped']++; continue; }

            $reviewerId = resolve_user($pdo, $r['reviewer_id'] ?? null);

            try {
                if (!$dryRun) {
                    $stmt = $pdo->prepare("
                        INSERT INTO reports
                            (user_id, reviewer_id, week_start, week_number, year, title,
                             activities, learnings, status,
                             submitted_at, reviewed_at, signed_at, reviewer_comment,
                             file_url, signed_file_url)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ");
                    $fileUrl = null;
                    if (!empty($r['file']) && is_array($r['file'])) {
                        $fileUrl = $r['file']['url'] ?? $r['file']['path'] ?? null;
                    } elseif (!empty($r['file']) && is_string($r['file'])) {
                        $fileUrl = $r['file'];
                    }
                    $stmt->execute([
                        $userId, $reviewerId, $weekStart,
                        !empty($r['week_number']) ? (int)$r['week_number'] : null,
                        !empty($r['year']) ? (int)$r['year'] : null,
                        $r['title'] ?? null, $r['activities'] ?? null, $r['learnings'] ?? null, $repStatus,
                        safe_ts($r['submitted_at'] ?? null, "report:{$blobRepId}.submitted_at"),
                        safe_ts($r['reviewed_at']  ?? null, "report:{$blobRepId}.reviewed_at"),
                        safe_ts($r['signed_at']    ?? null, "report:{$blobRepId}.signed_at"),
                        $r['review_comment'] ?? $r['reviewer_comment'] ?? null,
                        $fileUrl, null,
                    ]);
                    $relRepId = (int)$pdo->lastInsertId();
                    register_map($pdo, 'report', $blobRepId, $relRepId);

                    if (!empty($r['file'])) {
                        $stats['report_files'] += migrate_report_file($pdo, $relRepId, $userId, $blobRepId, $r['file'], false);
                    }
                }
            } catch (\Throwable $e) {
                error_log("[migration] migrate_reports skip report:{$blobRepId}: " . $e->getMessage());
                $stats['skipped']++;
                continue;
            }
            $stats['reports']++;
        }

        return $stats;
    }
}

if (!function_exists('migrate_blob_entities')) {
    /**
     * Orchestrator: spiegelt einen kompletten App-Blob insert-only in alle
     * relationalen Tabellen. Wiederverwendet von migrate_blob_to_relational.php (CLI)
     * und vom Dual-Write in api/routes/data.php.
     *
     * Voraussetzung: Ziel-Tabellen + migration_blob_id_map existieren (Aufrufer prüft).
     * Idempotent — wiederholte Aufrufe mit gleichem Blob legen nichts doppelt an.
     */
    function migrate_blob_entities(PDO $pdo, array $blob, bool $dryRun = false): array {
        $stats = [
            'projects'=>0,'tasks'=>0,'requirements'=>0,'materials'=>0,'reports'=>0,
            'quizzes'=>0,'quiz_questions'=>0,'quiz_answers'=>0,
            'learning_paths'=>0,'learning_path_nodes'=>0,'learning_path_edges'=>0,'learning_path_progress'=>0,
            'time_entries'=>0,'calendar_events'=>0,'report_files'=>0,'training_plan_users'=>0,
            'skipped'=>0,
        ];

        $parts = [
            migrate_projects($pdo, $blob['projects'] ?? [], $dryRun),
            migrate_reports($pdo, $blob['reports'] ?? [], $dryRun),
            migrate_quizzes($pdo, $blob['quizzes'] ?? [], $dryRun),
            migrate_learning_paths($pdo, $blob['learningPaths'] ?? [], $blob['pathProgress'] ?? [], $dryRun),
            migrate_calendar_events($pdo, $blob['calendarEvents'] ?? [], $dryRun),
            migrate_training_plan($pdo, $blob['trainingPlan'] ?? null, $dryRun),
        ];
        foreach ($parts as $s) {
            foreach ($s as $k => $v) $stats[$k] = ($stats[$k] ?? 0) + $v;
        }

        return $stats;
    }
}
