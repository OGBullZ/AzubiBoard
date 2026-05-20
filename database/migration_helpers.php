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
