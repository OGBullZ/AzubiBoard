<?php
// ============================================================
//  Route: /api/trainingPlan
//  Sprint 12 Phase 3 (2/2): Trainingsplan des aktuellen Azubis
//
//  GET  /api/trainingPlan   → training_plan JSON des eingeloggten Nutzers
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];

// GET /api/trainingPlan
if ($method === 'GET' && $id === null) {
    $s = db()->prepare("SELECT training_plan FROM users WHERE id = ? LIMIT 1");
    $s->execute([$uid]);
    $row = $s->fetch();
    if (!$row) error('Nutzer nicht gefunden', 404);

    $plan = null;
    if (!empty($row['training_plan'])) {
        $plan = json_decode($row['training_plan'], true);
    }
    // Sicherstellen dass Grundstruktur vorhanden
    if (!is_array($plan)) $plan = [];
    if (!isset($plan['goals']))    $plan['goals']    = [];
    if (!array_key_exists('examDate', $plan)) $plan['examDate'] = null;

    respond($plan);
}

error('Methode nicht erlaubt', 405);
