<?php
// ============================================================
//  Sprint 12 Phase 2 — Schema-Migration CLI-Wrapper
//
//  Usage:
//    php database/migrations/sprint12_phase2.php          # apply
//    php database/migrations/sprint12_phase2.php --dry-run # nur SQL ausgeben (todo)
//
//  Idempotent: kann beliebig oft ausgeführt werden, vorhandene
//  Tabellen/Spalten werden übersprungen.
// ============================================================

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Nur CLI.\n");
}

$root = dirname(__DIR__, 2);
require_once $root . '/api/db.php';
require_once $root . '/database/migration_helpers.php';

$pdo = db();
echo "Phase 2 Schema-Migration läuft gegen "
   . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "...\n";

try {
    $log = apply_phase2_schema($pdo);
    foreach ($log as $line) echo "  $line\n";
    echo "Fertig. " . count($log) . " Schritte.\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "FEHLER: " . $e->getMessage() . "\n");
    exit(1);
}
