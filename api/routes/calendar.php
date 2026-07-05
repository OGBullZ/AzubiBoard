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
    // RLS (Bug-Hunt 2026-07-04): Ausbilder nur auf Events aus eigenen Gruppen einschränken
    // (Event-Eigentümer teilt eine Gruppe) — vorher gab der Ausbilder-Zweig JEDES Event zurück
    // (Cross-Mandanten-Leak). Nicht-Ausbilder: nur eigene Events.
    if ($role === 'ausbilder') {
        $gf = with_group_filter_users(db(), $auth, 'user_id');
        $s  = db()->prepare("SELECT * FROM calendar_events WHERE id = ? AND ({$gf['clause']}) LIMIT 1");
        $s->execute([$id, ...$gf['params']]);
    } else {
        $s = db()->prepare("SELECT * FROM calendar_events WHERE id = ? AND user_id = ? LIMIT 1");
        $s->execute([$id, $uid]);
    }
    $ev = $s->fetch();
    if (!$ev) error('Ereignis nicht gefunden', 404);
    respond($ev);
}

// GET /api/calendar — globale Events (project_id IS NULL) des eigenen Nutzers
if ($method === 'GET' && $id === null) {
    if ($role === 'ausbilder') {
        // Ausbilder: globale Events, aber nur von Nutzern aus eigenen Gruppen (RLS wie oben;
        // ohne Gruppen-Mitgliedschaft → 1=1, kein Regress). Vorher: ALLE globalen Events.
        $gf = with_group_filter_users(db(), $auth, 'user_id');
        $s  = db()->prepare("SELECT * FROM calendar_events WHERE project_id IS NULL AND ({$gf['clause']}) ORDER BY event_date, start_time");
        $s->execute($gf['params']);
    } else {
        $s = db()->prepare("SELECT * FROM calendar_events WHERE project_id IS NULL AND user_id = ? ORDER BY event_date, start_time");
        $s->execute([$uid]);
    }
    respond($s->fetchAll());
}

error('Methode nicht erlaubt', 405);
