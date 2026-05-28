<?php
// ============================================================
//  rls.php — Row-Level-Security-Helper (Sprint 12 L5-6a)
//
//  Side-effect-frei (nur Funktions-Definitionen), damit sowohl die
//  API-Routes (via config.php) als auch PHPUnit es laden können.
//
//  Mehrmandanten-Vorbereitung: Ausbilder-Queries, die heute ALLE Daten
//  liefern, werden auf die Gruppen des eingeloggten Users eingeschränkt.
//
//  Nicht-Brechen-Garantie: User OHNE Gruppen-Mitgliedschaft bekommen
//  KEINE Einschränkung (Klausel `1=1`). So bleibt ein Single-Group- oder
//  Gruppen-loses Setup unverändert; Isolation greift erst, sobald
//  group_members befüllt ist.
// ============================================================

declare(strict_types=1);

if (!function_exists('user_group_ids')) {
    /**
     * Liefert die group_ids, in denen der User Mitglied ist (als int[]).
     */
    function user_group_ids(PDO $pdo, int $userId): array {
        if ($userId <= 0) return [];
        $s = $pdo->prepare('SELECT group_id FROM group_members WHERE user_id = ?');
        $s->execute([$userId]);
        return array_map('intval', $s->fetchAll(PDO::FETCH_COLUMN));
    }
}

if (!function_exists('with_group_filter')) {
    /**
     * Baut eine parametrisierte WHERE-Teilklausel, die Zeilen auf die Gruppen
     * des Users einschränkt (für Tabellen mit group_id-Spalte, z. B. projects).
     *
     * @param array  $user  JWT-Payload (erwartet 'sub'; 'role' optional)
     * @param string $col   Spaltenname/Alias der group_id-Spalte
     * @return array{clause:string, params:int[]}
     *
     * - Keine Gruppen-Mitgliedschaft → ['clause' => '1=1', 'params' => []] (keine Einschränkung).
     * - Sonst → "(col IN (?,..) OR col IS NULL)": migrierte Datensätze mit
     *   group_id = NULL bleiben sichtbar (sonst unsichtbarer Data-Loss).
     */
    function with_group_filter(PDO $pdo, array $user, string $col = 'group_id'): array {
        $gids = user_group_ids($pdo, (int)($user['sub'] ?? 0));
        if (!$gids) return ['clause' => '1=1', 'params' => []];
        $placeholders = implode(',', array_fill(0, count($gids), '?'));
        return ['clause' => "($col IN ($placeholders) OR $col IS NULL)", 'params' => $gids];
    }
}

if (!function_exists('with_group_filter_users')) {
    /**
     * Wie with_group_filter, aber für die `users`-Tabelle (die selbst keine
     * group_id-Spalte hat). Schränkt auf Nutzer ein, die mindestens eine Gruppe
     * mit dem User teilen; der User selbst ist immer enthalten.
     *
     * @param string $col  Spaltenname/Alias der user-id-Spalte (default 'id')
     * @return array{clause:string, params:int[]}
     */
    function with_group_filter_users(PDO $pdo, array $user, string $col = 'id'): array {
        $uid  = (int)($user['sub'] ?? 0);
        $gids = user_group_ids($pdo, $uid);
        if (!$gids) return ['clause' => '1=1', 'params' => []];
        $placeholders = implode(',', array_fill(0, count($gids), '?'));
        $clause = "($col IN (SELECT user_id FROM group_members WHERE group_id IN ($placeholders)) OR $col = ?)";
        return ['clause' => $clause, 'params' => [...$gids, $uid]];
    }
}
