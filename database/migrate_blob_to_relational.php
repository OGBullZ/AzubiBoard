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
migration_ensure_map_table($pdo);

// ── Blob laden ────────────────────────────────────────────────
$row = $pdo->query('SELECT content FROM app_data WHERE id = 1')->fetch();
if (!$row) {
    echo "WARN: Kein app_data Eintrag gefunden — nichts zu migrieren.\n";
    exit(0);
}
$blob = json_decode($row['content'], true);
if (json_last_error() !== JSON_ERROR_NONE) die("FEHLER: Blob ist kein gültiges JSON\n");

// ── Migration (Orchestrator in migration_helpers.php) ────────
// Projekte/Tasks/Requirements/Materials/Reports + P2-2-Entitäten
// (Quizzes, Lernpfade, Kalender, Trainingsplan, Zeit, Report-Files).
// Logik liegt in migrate_blob_entities() — geteilt mit dem Dual-Write
// in api/routes/data.php (L5-5), damit es nur EINE Quelle gibt.
echo "\nMigriere Entitäten...\n";
$stats = migrate_blob_entities($pdo, $blob, $dryRun);

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
