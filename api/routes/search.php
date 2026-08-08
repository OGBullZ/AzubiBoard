<?php
// ============================================================
//  Route: GET /api/search?q=...
//  Sprint 13 L5-7: FULLTEXT-Suche über relationale Tabellen.
//
//  Sucht parallel in: projects · tasks · reports · learning_path_nodes
//  RLS: Azubi sieht nur zugewiesene Projekte + eigene Reports.
//  Ausbilder sieht alles der eigenen Gruppe(n).
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];
$role = $auth['role'] ?? 'azubi';

if ($method !== 'GET') error('Methode nicht erlaubt', 405);

$q = trim($_GET['q'] ?? '');
if (strlen($q) < 2) {
    respond(['results' => [], 'query' => $q]);
}

// Bug-Hunt 08-06 #13: $limit wird unten direkt in die LIMIT-Klausel interpoliert
// (wie in audit.php), weil `LIMIT ?` bei ATTR_EMULATE_PREPARES=false als String
// gebunden wird und MySQL dann 1210 wirft — der Fehler landete im catch und die
// Suche lieferte dauerhaft 0 Treffer, ohne dass irgendwo etwas sichtbar wurde.
// Der (int)-Cast macht die Interpolation sicher; max(1, …) fängt negative Werte ab,
// die sonst ein syntaktisch ungültiges `LIMIT -5` ergäben.
$limit = max(1, min((int)($_GET['limit'] ?? 15), 50));

// Für FULLTEXT: query mit * für Prefix-Suche aufbereiten.
// Sonderzeichen escapen damit BOOLEAN MODE nicht explodiert.
$clean  = preg_replace('/[+\-><()\~*"@]+/', ' ', $q);
$ftQ    = implode(' ', array_map(fn($w) => '+' . $w . '*', array_filter(explode(' ', trim($clean)))));
if (!$ftQ) $ftQ = $clean . '*';

$results = [];

// ── Projekte ──────────────────────────────────────────────────
try {
    if ($role === 'ausbilder') {
        $gf = with_group_filter(db(), $auth, 'group_id');
        $sql = "
            SELECT 'project' AS type, id, title,
                   SUBSTRING(COALESCE(description,''), 1, 120) AS sub,
                   MATCH(title, description) AGAINST (? IN BOOLEAN MODE) AS score
            FROM projects
            WHERE archived = 0 AND {$gf['clause']}
              AND MATCH(title, description) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ";
        $s = db()->prepare($sql);
        $s->execute([$ftQ, ...$gf['params'], $ftQ]);
    } else {
        $s = db()->prepare("
            SELECT 'project' AS type, p.id, p.title,
                   SUBSTRING(COALESCE(p.description,''), 1, 120) AS sub,
                   MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE) AS score
            FROM projects p
            JOIN project_assignments pa ON pa.project_id = p.id
            WHERE pa.user_id = ? AND p.archived = 0
              AND MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ");
        $s->execute([$ftQ, $uid, $ftQ]);
    }
    foreach ($s->fetchAll() as $row) {
        $results[] = [
            'type'  => 'Projekt',
            'label' => $row['title'],
            'sub'   => $row['sub'] ?: null,
            'to'    => '/project/' . $row['id'],
            'icon'  => 'project',
            'score' => (float)$row['score'],
        ];
    }
} catch (Throwable $e) { /* Suche überspringen wenn Index fehlt */ }

// ── Tasks ────────────────────────────────────────────────────
try {
    if ($role === 'ausbilder') {
        $gf = with_group_filter(db(), $auth, 'p.group_id');
        $sql = "
            SELECT 'task' AS type, t.id, t.title,
                   SUBSTRING(COALESCE(t.description,''), 1, 120) AS sub,
                   t.project_id,
                   MATCH(t.title, t.description) AGAINST (? IN BOOLEAN MODE) AS score
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE p.archived = 0 AND {$gf['clause']}
              AND MATCH(t.title, t.description) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ";
        $s = db()->prepare($sql);
        $s->execute([$ftQ, ...$gf['params'], $ftQ]);
    } else {
        $s = db()->prepare("
            SELECT 'task' AS type, t.id, t.title,
                   SUBSTRING(COALESCE(t.description,''), 1, 120) AS sub,
                   t.project_id,
                   MATCH(t.title, t.description) AGAINST (? IN BOOLEAN MODE) AS score
            FROM tasks t
            JOIN project_assignments pa ON pa.project_id = t.project_id
            WHERE pa.user_id = ?
              AND MATCH(t.title, t.description) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ");
        $s->execute([$uid, $ftQ, $ftQ]);
    }
    foreach ($s->fetchAll() as $row) {
        $results[] = [
            'type'  => 'Aufgabe',
            'label' => $row['title'],
            'sub'   => $row['sub'] ?: null,
            'to'    => '/project/' . $row['project_id'],
            'icon'  => 'task',
            'score' => (float)$row['score'],
        ];
    }
} catch (Throwable $e) { /* */ }

// ── Reports ──────────────────────────────────────────────────
try {
    if ($role === 'ausbilder') {
        // RLS: nur Reports von Azubis aus geteilten Gruppen (analog projects/tasks oben).
        $gf = with_group_filter_users(db(), $auth, 'user_id');
        $s = db()->prepare("
            SELECT id, title,
                   SUBSTRING(COALESCE(activities,''), 1, 120) AS sub,
                   MATCH(title, activities, learnings) AGAINST (? IN BOOLEAN MODE) AS score
            FROM reports
            WHERE {$gf['clause']}
              AND MATCH(title, activities, learnings) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ");
        $s->execute([$ftQ, ...$gf['params'], $ftQ]);
    } else {
        $s = db()->prepare("
            SELECT id, title,
                   SUBSTRING(COALESCE(activities,''), 1, 120) AS sub,
                   MATCH(title, activities, learnings) AGAINST (? IN BOOLEAN MODE) AS score
            FROM reports
            WHERE user_id = ?
              AND MATCH(title, activities, learnings) AGAINST (? IN BOOLEAN MODE) > 0
            ORDER BY score DESC LIMIT {$limit}
        ");
        $s->execute([$uid, $ftQ, $ftQ]);
    }
    foreach ($s->fetchAll() as $row) {
        $results[] = [
            'type'  => 'Bericht',
            'label' => $row['title'] ?: 'Bericht #' . $row['id'],
            'sub'   => $row['sub'] ?: null,
            'to'    => '/reports',
            'icon'  => 'report',
            'score' => (float)$row['score'],
        ];
    }
} catch (Throwable $e) { /* */ }

// ── Lernpfad-Inhalte ─────────────────────────────────────────
try {
    $s = db()->prepare("
        SELECT n.id, n.title,
               SUBSTRING(COALESCE(n.description,''), 1, 120) AS sub,
               n.path_id,
               MATCH(n.title, n.description, n.content) AGAINST (? IN BOOLEAN MODE) AS score
        FROM learning_path_nodes n
        WHERE MATCH(n.title, n.description, n.content) AGAINST (? IN BOOLEAN MODE) > 0
        ORDER BY score DESC LIMIT {$limit}
    ");
    $s->execute([$ftQ, $ftQ]);
    foreach ($s->fetchAll() as $row) {
        $results[] = [
            'type'  => 'Lerninhalt',
            'label' => $row['title'],
            'sub'   => $row['sub'] ?: null,
            'to'    => '/learn',
            'icon'  => 'learn',
            'score' => (float)$row['score'],
        ];
    }
} catch (Throwable $e) { /* */ }

// Score-sortiert, auf $limit kürzen
usort($results, fn($a, $b) => $b['score'] <=> $a['score']);
respond([
    'results' => array_slice($results, 0, $limit),
    'query'   => $q,
]);
