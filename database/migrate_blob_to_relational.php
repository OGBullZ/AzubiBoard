<?php
// ============================================================
//  AzubiBoard – Blob-zu-Relational Migration (L5-1)
//  Liest app_data.content und schreibt in die relationalen
//  Tabellen (projects, tasks, requirements, materials, reports).
//
//  Idempotent: migration_blob_id_map verhindert Doppelinserts.
//  Backup davor Pflicht — dieses Script verändert Daten!
//
//  Ausführen:
//    php database/migrate_blob_to_relational.php
//    php database/migrate_blob_to_relational.php --dry-run
// ============================================================

if (PHP_SAPI !== 'cli' && isset($_SERVER['HTTP_HOST'])) {
    http_response_code(403);
    die("403 Forbidden. Nur per CLI ausführen.\n");
}

$dryRun = in_array('--dry-run', $argv ?? [], true);

// ── .env einlesen ─────────────────────────────────────────────
$envFile = dirname(__DIR__) . '/.env';
if (!file_exists($envFile)) die("FEHLER: .env nicht gefunden\n");
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
    [$k, $v] = explode('=', $line, 2);
    $k = trim($k); $v = trim($v, " \t\n\r\"'");
    if (!array_key_exists($k, $_ENV)) { putenv("$k=$v"); $_ENV[$k] = $v; }
}

$host = $_ENV['DB_HOST'] ?? 'localhost';
$port = (int)($_ENV['DB_PORT'] ?? 3306);
$db   = $_ENV['DB_NAME'] ?? 'azubiboard';
$user = $_ENV['DB_USER'] ?? 'root';
$pass = $_ENV['DB_PASS'] ?? '';

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    die("FEHLER: " . $e->getMessage() . "\n");
}

echo ($dryRun ? "[DRY-RUN] " : "") . "AzubiBoard Blob→Relational Migration\n";
echo str_repeat("─", 50) . "\n";

// ── Helpers laden (P0-4 Refactor) ─────────────────────────────
require_once __DIR__ . '/migration_helpers.php';

// ── Pre-Flight: alle Ziel-Tabellen müssen existieren (P0-6) ──
try {
    migration_check_required_tables($pdo, [
        'users', 'groups', 'group_members',
        'projects', 'project_assignments',
        'tasks', 'requirements', 'materials', 'reports',
        // P2-2 neue Ziele:
        'quizzes', 'quiz_questions', 'quiz_answers',
        'learning_paths', 'learning_path_nodes', 'learning_path_edges', 'learning_path_progress',
        'time_entries', 'calendar_events', 'report_files',
    ]);
} catch (RuntimeException $e) {
    die("FEHLER: " . $e->getMessage() . "\n");
}

// ── Mapping-Tabelle (Idempotenz) ──────────────────────────────
$pdo->exec("
    CREATE TABLE IF NOT EXISTS migration_blob_id_map (
        entity_type VARCHAR(50)  NOT NULL,
        blob_id     VARCHAR(100) NOT NULL,
        rel_id      INT UNSIGNED NOT NULL,
        migrated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entity_type, blob_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── Blob laden ────────────────────────────────────────────────
$row = $pdo->query('SELECT content FROM app_data WHERE id = 1')->fetch();
if (!$row) {
    echo "WARN: Kein app_data Eintrag gefunden — nichts zu migrieren.\n";
    exit(0);
}
$blob = json_decode($row['content'], true);
if (json_last_error() !== JSON_ERROR_NONE) die("FEHLER: Blob ist kein gültiges JSON\n");

$stats = [
    'projects' => 0, 'tasks' => 0, 'requirements' => 0, 'materials' => 0, 'reports' => 0,
    'quizzes' => 0, 'quiz_questions' => 0, 'quiz_answers' => 0,
    'learning_paths' => 0, 'learning_path_nodes' => 0, 'learning_path_edges' => 0, 'learning_path_progress' => 0,
    'time_entries' => 0, 'calendar_events' => 0, 'report_files' => 0, 'training_plan_users' => 0,
    'skipped' => 0,
];

// Hilfsfunktionen sind jetzt in database/migration_helpers.php (P0-4 Refactor):
//   mapped_id, register_map, resolve_user, safe_date, safe_ts,
//   migration_check_required_tables, resolve_group_for_user, migration_status_or_default

// ── Projekte ──────────────────────────────────────────────────
echo "\nProjekte...\n";
$projects = $blob['projects'] ?? [];
foreach ($projects as $p) {
    $blobProjId = (string)($p['id'] ?? '');
    if (!$blobProjId) continue;

    if (mapped_id($pdo, 'project', $blobProjId)) {
        $stats['skipped']++;
        echo "  SKIP project:{$blobProjId}\n";
        continue;
    }

    $createdBy = resolve_user($pdo, $p['user_id'] ?? $p['created_by'] ?? null);
    $title     = trim((string)($p['title'] ?? $p['name'] ?? 'Unbenanntes Projekt'));
    $status    = migration_status_or_default($p['status'] ?? null, ['green','yellow','red'], 'yellow');
    $priority  = migration_status_or_default($p['priority'] ?? null, ['low','medium','high','critical'], 'medium');
    $unit      = migration_status_or_default($p['netzplan_unit'] ?? null, ['W','T','M'], 'W');
    $archived  = !empty($p['archived']) ? 1 : 0;
    // P0-6 Fix: group_id aus Gruppen-Mitgliedschaft des Erstellers ableiten
    // (vorher immer NULL → RLS-Bruch für Gruppen-Mitglieder ausser dem Ersteller).
    $groupId   = resolve_group_for_user($pdo, $createdBy);

    if (!$dryRun) {
        // P0-6 Fix: Transaktion pro Projekt — alles oder nichts (verhindert
        // Halbzustand bei Crash mitten in Tasks/Requirements/Materials).
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("
                INSERT INTO projects
                    (group_id, created_by, title, description, status, priority,
                     start_date, deadline, netzplan_unit, color, archived)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $groupId,
                $createdBy,
                $title,
                $p['description'] ?? null,
                $status,
                $priority,
                safe_date($p['start_date'] ?? null, "project:{$blobProjId}.start_date"),
                safe_date($p['deadline']   ?? null, "project:{$blobProjId}.deadline"),
                $unit,
                $p['color'] ?? null,
                $archived,
            ]);
            $relProjId = (int)$pdo->lastInsertId();
            register_map($pdo, 'project', $blobProjId, $relProjId);

            // Projekt-Assignment für den Ersteller
            if ($createdBy) {
                $pdo->prepare("INSERT IGNORE INTO project_assignments (project_id, user_id, assigned_by) VALUES (?,?,?)")
                    ->execute([$relProjId, $createdBy, $createdBy]);
            }
        } catch (\Throwable $e) {
            $pdo->rollBack();
            echo "  ! FEHLER bei project:{$blobProjId} — Rollback: " . $e->getMessage() . "\n";
            $stats['skipped']++;
            continue;
        }
    } else {
        $relProjId = 0;
    }

    $stats['projects']++;
    echo "  + project:{$blobProjId} → {$title}\n";

    // ── Tasks ──────────────────────────────────────────────────
    foreach ($p['tasks'] ?? [] as $t) {
        $blobTaskId = (string)($t['id'] ?? '');
        if (!$blobTaskId) continue;
        if (mapped_id($pdo, 'task', $blobTaskId)) { $stats['skipped']++; continue; }

        $taskTitle = trim((string)($t['text'] ?? $t['title'] ?? ''));
        if (!$taskTitle) continue;

        $done = !empty($t['done']);
        $rawStatus = $t['status'] ?? ($done ? 'done' : 'open');
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
                $relProjId,
                $assignedTo,
                $createdBy,
                $taskTitle,
                $t['description'] ?? null,
                $t['note'] ?? null,
                $t['doc'] ?? null,
                $t['protocol'] ?? null,
                $taskStatus,
                $taskPrio,
                safe_date($t['due_date'] ?? null, "task:{$blobTaskId}.due_date"),
                !empty($t['estimated_minutes']) ? (int)$t['estimated_minutes'] : null,
                $completedAt,
            ]);
            $relTaskId = (int)$pdo->lastInsertId();
            register_map($pdo, 'task', $blobTaskId, $relTaskId);

            // P2-2: Inline timeLog → time_entries
            if (!empty($t['timeLog']) && is_array($t['timeLog'])) {
                $tlOwner = $assignedTo ?: $createdBy;
                $stats['time_entries'] += migrate_time_entries_for_task(
                    $pdo, $relTaskId, $relProjId, $tlOwner, $blobTaskId, $t['timeLog'], $dryRun
                );
            }
        }
        $stats['tasks']++;
    }

    // ── Requirements ───────────────────────────────────────────
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
                $relProjId,
                $reqTitle,
                $r['description'] ?? null,
                !empty($r['done']) ? 1 : 0,
                $prio,
                $i,
                !empty($r['done']) ? safe_ts($r['completed_at'] ?? date('Y-m-d H:i:s'), "req:{$blobReqId}.completed_at") : null,
            ]);
            register_map($pdo, 'requirement', $blobReqId, (int)$pdo->lastInsertId());
        }
        $stats['requirements']++;
    }

    // ── Materials ──────────────────────────────────────────────
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
                $relProjId,
                $matName,
                $m['description'] ?? null,
                max(0.01, (float)($m['quantity'] ?? 1)),
                $m['unit'] ?? 'Stück',
                max(0, (float)($m['unit_cost'] ?? 0)),
                $m['supplier'] ?? null,
                !empty($m['ordered']) ? 1 : 0,
                $i,
            ]);
            register_map($pdo, 'material', $blobMatId, (int)$pdo->lastInsertId());
        }
        $stats['materials']++;
    }

    // P0-6: Commit der Projekt-Transaktion (alles ging gut wenn wir hier ankommen)
    if (!$dryRun && $pdo->inTransaction()) {
        $pdo->commit();
    }
}

// ── Berichte ──────────────────────────────────────────────────
echo "\nBerichte...\n";
foreach ($blob['reports'] ?? [] as $r) {
    $blobRepId = (string)($r['id'] ?? '');
    if (!$blobRepId) continue;
    if (mapped_id($pdo, 'report', $blobRepId)) {
        $stats['skipped']++;
        echo "  SKIP report:{$blobRepId}\n";
        continue;
    }

    $userId = resolve_user($pdo, $r['user_id'] ?? null);
    if (!$userId) {
        echo "  SKIP report:{$blobRepId} (user_id nicht auflösbar: {$r['user_id']})\n";
        $stats['skipped']++;
        continue;
    }

    $rawStatus = $r['status'] ?? 'draft';
    $repStatus = migration_status_or_default($rawStatus, ['draft','submitted','reviewed','signed'], 'draft');
    $weekStart = safe_date($r['week_start'] ?? null, "report:{$blobRepId}.week_start");
    if (!$weekStart) {
        echo "  SKIP report:{$blobRepId} (kein week_start)\n";
        $stats['skipped']++;
        continue;
    }

    $reviewerId = resolve_user($pdo, $r['reviewer_id'] ?? null);

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
            $userId,
            $reviewerId,
            $weekStart,
            !empty($r['week_number']) ? (int)$r['week_number'] : null,
            !empty($r['year']) ? (int)$r['year'] : null,
            $r['title'] ?? null,
            $r['activities'] ?? null,
            $r['learnings'] ?? null,
            $repStatus,
            safe_ts($r['submitted_at'] ?? null, "report:{$blobRepId}.submitted_at"),
            safe_ts($r['reviewed_at']  ?? null, "report:{$blobRepId}.reviewed_at"),
            safe_ts($r['signed_at']    ?? null, "report:{$blobRepId}.signed_at"),
            $r['review_comment'] ?? $r['reviewer_comment'] ?? null,
            $fileUrl,
            null,
        ]);
        $relRepId = (int)$pdo->lastInsertId();
        register_map($pdo, 'report', $blobRepId, $relRepId);

        // P2-2: report.file → report_files (zusätzlich zum legacy reports.file_url)
        if (!empty($r['file'])) {
            $stats['report_files'] += migrate_report_file(
                $pdo, $relRepId, $userId, $blobRepId, $r['file'], false
            );
        }
    }
    $stats['reports']++;
    echo "  + report:{$blobRepId} → KW{$r['week_number']}/{$r['year']}\n";
}

// ── P2-2: Quizzes / Lernpfade / Kalender / Trainingsplan ──────
echo "\nQuizzes...\n";
$qStats = migrate_quizzes($pdo, $blob['quizzes'] ?? [], $dryRun);
foreach (['quizzes','quiz_questions','quiz_answers'] as $k) { $stats[$k] += $qStats[$k]; }
$stats['skipped'] += $qStats['skipped'];

echo "Lernpfade...\n";
$lpStats = migrate_learning_paths($pdo, $blob['learningPaths'] ?? [], $blob['pathProgress'] ?? [], $dryRun);
foreach (['learning_paths','learning_path_nodes','learning_path_edges','learning_path_progress'] as $k) {
    $stats[$k] += $lpStats[$k];
}
$stats['skipped'] += $lpStats['skipped'];

echo "Kalender-Events...\n";
$cStats = migrate_calendar_events($pdo, $blob['calendarEvents'] ?? [], $dryRun);
$stats['calendar_events'] += $cStats['calendar_events'];
$stats['skipped']         += $cStats['skipped'];

echo "Trainingsplan...\n";
$tpStats = migrate_training_plan($pdo, $blob['trainingPlan'] ?? null, $dryRun);
$stats['training_plan_users'] += $tpStats['training_plan_users'];
$stats['skipped']             += $tpStats['skipped'];

// ── Zusammenfassung ───────────────────────────────────────────
echo "\n" . str_repeat("─", 50) . "\n";
echo ($dryRun ? "[DRY-RUN] " : "✓ ") . "Migration abgeschlossen:\n";
foreach ($stats as $k => $v) {
    echo "  {$k}: {$v}\n";
}
if ($dryRun) {
    echo "\nKeine Daten geändert. Ohne --dry-run erneut ausführen.\n";
} else {
    echo "\nNächster Schritt: VITE_USE_SCHEMA=true setzen und Phase 2 (Dual-Write) starten.\n";
}
