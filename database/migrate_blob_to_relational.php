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

$stats = ['projects' => 0, 'tasks' => 0, 'requirements' => 0, 'materials' => 0, 'reports' => 0, 'skipped' => 0];

// ── Hilfsfunktionen ───────────────────────────────────────────
function mapped_id(PDO $pdo, string $type, string $blobId): ?int {
    $s = $pdo->prepare('SELECT rel_id FROM migration_blob_id_map WHERE entity_type=? AND blob_id=?');
    $s->execute([$type, $blobId]);
    $r = $s->fetchColumn();
    return $r !== false ? (int)$r : null;
}
function register_map(PDO $pdo, string $type, string $blobId, int $relId): void {
    $pdo->prepare('INSERT IGNORE INTO migration_blob_id_map (entity_type, blob_id, rel_id) VALUES (?,?,?)')
        ->execute([$type, $blobId, $relId]);
}
function resolve_user(PDO $pdo, mixed $blobUserId): ?int {
    if (!$blobUserId) return null;
    $id = (int)$blobUserId;
    if ($id <= 0) return null;
    $s = $pdo->prepare('SELECT id FROM users WHERE id=? LIMIT 1');
    $s->execute([$id]);
    $r = $s->fetchColumn();
    return $r !== false ? (int)$r : null;
}
function safe_date(?string $d): ?string {
    if (!$d) return null;
    $t = strtotime($d);
    return $t ? date('Y-m-d', $t) : null;
}
function safe_ts(?string $d): ?string {
    if (!$d) return null;
    $t = strtotime($d);
    return $t ? date('Y-m-d H:i:s', $t) : null;
}

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
    $status    = in_array($p['status'] ?? '', ['green','yellow','red']) ? $p['status'] : 'yellow';
    $priority  = in_array($p['priority'] ?? '', ['low','medium','high','critical']) ? $p['priority'] : 'medium';
    $unit      = in_array($p['netzplan_unit'] ?? '', ['W','T','M']) ? $p['netzplan_unit'] : 'W';
    $archived  = !empty($p['archived']) ? 1 : 0;

    if (!$dryRun) {
        $stmt = $pdo->prepare("
            INSERT INTO projects
                (group_id, created_by, title, description, status, priority,
                 start_date, deadline, netzplan_unit, color, archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            null,
            $createdBy,
            $title,
            $p['description'] ?? null,
            $status,
            $priority,
            safe_date($p['start_date'] ?? null),
            safe_date($p['deadline'] ?? null),
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
        $taskStatus = in_array($rawStatus, ['open','in_progress','done','blocked','waiting']) ? $rawStatus : ($done ? 'done' : 'open');
        $taskPrio   = in_array($t['priority'] ?? '', ['low','medium','high']) ? $t['priority'] : 'medium';
        $assignedTo = resolve_user($pdo, $t['assigned_to'] ?? null);

        if (!$dryRun && $relProjId) {
            $stmt = $pdo->prepare("
                INSERT INTO tasks
                    (project_id, assigned_to, created_by, title, description, note, doc, protocol,
                     status, priority, due_date, estimated_minutes, completed_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ");
            $completedAt = ($taskStatus === 'done' && !empty($t['completed_at']))
                ? safe_ts($t['completed_at']) : null;
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
                safe_date($t['due_date'] ?? null),
                !empty($t['estimated_minutes']) ? (int)$t['estimated_minutes'] : null,
                $completedAt,
            ]);
            register_map($pdo, 'task', $blobTaskId, (int)$pdo->lastInsertId());
        }
        $stats['tasks']++;
    }

    // ── Requirements ───────────────────────────────────────────
    foreach ($p['requirements'] ?? [] as $i => $r) {
        $blobReqId = (string)($r['id'] ?? "req_{$blobProjId}_{$i}");
        if (mapped_id($pdo, 'requirement', $blobReqId)) { $stats['skipped']++; continue; }

        $reqTitle = trim((string)($r['title'] ?? $r['text'] ?? ''));
        if (!$reqTitle) continue;
        $prio = in_array($r['priority'] ?? '', ['must','should','could']) ? $r['priority'] : 'must';

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
                !empty($r['done']) ? safe_ts($r['completed_at'] ?? date('Y-m-d H:i:s')) : null,
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
    $repStatus = in_array($rawStatus, ['draft','submitted','reviewed','signed']) ? $rawStatus : 'draft';
    $weekStart = safe_date($r['week_start'] ?? null);
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
            safe_ts($r['submitted_at'] ?? null),
            safe_ts($r['reviewed_at'] ?? null),
            safe_ts($r['signed_at'] ?? null),
            $r['review_comment'] ?? $r['reviewer_comment'] ?? null,
            $fileUrl,
            null,
        ]);
        register_map($pdo, 'report', $blobRepId, (int)$pdo->lastInsertId());
    }
    $stats['reports']++;
    echo "  + report:{$blobRepId} → KW{$r['week_number']}/{$r['year']}\n";
}

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
