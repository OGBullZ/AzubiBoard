<?php
// ============================================================
//  Route: /api/learningPaths[/:id]
//  Sprint 12 Phase 3 (2/2): Relational Lernpfade-Read
//
//  GET  /api/learningPaths      → Liste mit Nodes, Edges und User-Progress
//  GET  /api/learningPaths/:id  → Einzelner Pfad
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];

function load_path_full(PDO $pdo, int $id, int $uid): ?array {
    $s = $pdo->prepare("SELECT * FROM learning_paths WHERE id = ? LIMIT 1");
    $s->execute([$id]);
    $path = $s->fetch();
    if (!$path) return null;

    $s = $pdo->prepare("SELECT * FROM learning_path_nodes WHERE path_id = ? ORDER BY sort_order, id");
    $s->execute([$id]);
    $nodes = $s->fetchAll();

    // Edges: from_node → to_node bedeutet to_node hat from_node als Voraussetzung
    $s = $pdo->prepare("SELECT * FROM learning_path_edges WHERE path_id = ?");
    $s->execute([$id]);
    $edges = $s->fetchAll();

    // User-Progress für diesen Pfad
    $nodeIds = array_column($nodes, 'id');
    $progress = [];
    if ($nodeIds) {
        $ph = implode(',', array_fill(0, count($nodeIds), '?'));
        $s  = $pdo->prepare("SELECT * FROM learning_path_progress WHERE user_id = ? AND node_id IN ($ph)");
        $s->execute([$uid, ...$nodeIds]);
        foreach ($s->fetchAll() as $row) {
            $progress[(int)$row['node_id']] = [
                'completed'    => (bool)$row['completed'],
                'completed_at' => $row['completed_at'],
            ];
        }
    }

    $path['nodes']    = $nodes;
    $path['edges']    = $edges;
    $path['progress'] = $progress;
    return $path;
}

// GET /api/learningPaths/:id
if ($method === 'GET' && $id !== null) {
    $path = load_path_full(db(), $id, $uid);
    if (!$path) error('Lernpfad nicht gefunden', 404);
    respond($path);
}

// GET /api/learningPaths — Liste
if ($method === 'GET' && $id === null) {
    $rows = db()->query("SELECT * FROM learning_paths ORDER BY lehrjahr, created_at")->fetchAll();
    foreach ($rows as &$path) {
        $full = load_path_full(db(), (int)$path['id'], $uid);
        if ($full) $path = $full;
    }
    unset($path);
    respond($rows);
}

error('Methode nicht erlaubt', 405);
