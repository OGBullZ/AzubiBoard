<?php
// ============================================================
//  Route: /api/calendar[/:id]
//  Sprint 12 Phase 3 (2/2): Relational Kalender-Read
//
//  GET  /api/calendar       → Benutzer-Kalender-Ereignisse (ohne Projekt-Zuordnung)
//  GET  /api/calendar/:id   → Einzelnes Ereignis
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];
$role = $auth['role'] ?? 'azubi';

// GET /api/calendar/:id
if ($method === 'GET' && $id !== null) {
    $s = db()->prepare("SELECT * FROM calendar_events WHERE id = ? LIMIT 1");
    $s->execute([$id]);
    $ev = $s->fetch();
    if (!$ev) error('Ereignis nicht gefunden', 404);
    if ($role !== 'ausbilder' && (int)$ev['user_id'] !== $uid) error('Kein Zugriff', 403);
    respond($ev);
}

// GET /api/calendar — globale Events (project_id IS NULL) des eigenen Nutzers
if ($method === 'GET' && $id === null) {
    if ($role === 'ausbilder') {
        // Ausbilder: alle globalen Events
        $s = db()->query("SELECT * FROM calendar_events WHERE project_id IS NULL ORDER BY event_date, start_time");
    } else {
        $s = db()->prepare("SELECT * FROM calendar_events WHERE project_id IS NULL AND user_id = ? ORDER BY event_date, start_time");
        $s->execute([$uid]);
    }
    respond($s->fetchAll());
}

error('Methode nicht erlaubt', 405);
