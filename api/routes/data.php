<?php
// ============================================================
//  Route: GET|POST /api/data
//  Speichert den kompletten App-State als JSON in der DB.
//  Tabelle: app_data (id PK, content JSON, updated_at TIMESTAMP)
// ============================================================

$auth = require_auth();

// ── Tabelle anlegen wenn nicht vorhanden ─────────────────────
db()->exec("
    CREATE TABLE IF NOT EXISTS app_data (
        id         INT UNSIGNED NOT NULL DEFAULT 1,
        content    LONGTEXT     NOT NULL,
        version    BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── Bug-Hunt 08-06 #2: echter Versions-Zähler statt strtotime(updated_at) ──
//    Die „Version\" war die Unix-SEKUNDE der letzten Änderung. Zwei Saves innerhalb
//    derselben Sekunde ergaben dieselbe Version: der zweite Client bestand die
//    If-Match-Prüfung und überschrieb den ersten — ohne 409, ohne Konfliktdialog,
//    und der Poll (`version > lastVersion`) sah die Änderung nie. Bei EINER Blob-Zeile
//    für alle Nutzer trifft das jeden Save. Der Zähler steigt jetzt pro Schreibvorgang.
//    Bestandsinstallationen starten bei UNIX_TIMESTAMP(updated_at), damit die von
//    laufenden Clients gehaltenen ETags monoton anschließen und kein Pseudo-Konflikt
//    entsteht.
try {
    $hasVersion = db()->query("SHOW COLUMNS FROM app_data LIKE 'version'")->fetch();
    if (!$hasVersion) {
        db()->exec("ALTER TABLE app_data ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 0");
        db()->exec("UPDATE app_data SET version = UNIX_TIMESTAMP(updated_at) WHERE version = 0");
    }
} catch (Throwable $e) {
    error_log('[data.php] version-Spalte konnte nicht ergaenzt werden: ' . $e->getMessage());
}

// L4: History-Tabelle für rollende Backups (1 Snapshot pro Tag, 30 Tage)
db()->exec("
    CREATE TABLE IF NOT EXISTS app_data_history (
        snapshot_day DATE         NOT NULL,
        content      LONGTEXT     NOT NULL,
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        size_bytes   INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (snapshot_day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── GET /api/data/version ────────────────────────────────────
// Billiger Endpoint nur für Polling: liefert "Version" der letzten
// Änderung als Unix-Timestamp. Frontend pollt alle 20-30s und holt
// /api/data nur bei Änderung. FastCGI-kompatibel (keine SSE-Probleme).
if ($method === 'GET' && (($parts[1] ?? null) === 'version')) {
    $row = db()->query('SELECT version, updated_at FROM app_data WHERE id = 1')->fetch();
    respond([
        'version'    => $row ? data_version_of($row) : 0,
        'updated_at' => $row['updated_at'] ?? null,
    ]);
}

// ── GET /api/data ────────────────────────────────────────────
// WICHTIG (spezifisch vor allgemein): nur der bloße /data-Pfad. Sonst würde
// dieser Handler /data/backups{,/{day}} verschlucken (respond() beendet sofort).
if ($method === 'GET' && empty($parts[1] ?? null)) {
    // L5-DEP: Lesezugriff bleibt erhalten (Legacy + Backup), aber im
    // Schema-First-Modus signalisieren wir die Deprecation per Header.
    if (FORCE_SCHEMA) {
        header('Deprecation: true');
        header('Sunset: ' . gmdate('D, d M Y H:i:s', strtotime('+6 months')) . ' GMT');
    }
    $row = db()->query('SELECT content, version, updated_at FROM app_data WHERE id = 1')->fetch();
    if (!$row) {
        // ETag = 0 für leeren State
        header('ETag: "0"');
        respond(['projects'=>[],'users'=>[],'groups'=>[],'calendarEvents'=>[],'reports'=>[]]);
    }
    $data = json_decode($row['content'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error('Datenfehler: gespeichertes JSON ist ungültig', 500);
    }
    $version = data_version_of($row);
    header('ETag: "' . $version . '"');
    header('X-Data-Version: ' . $version);
    respond($data);
}

// ── POST /api/data ───────────────────────────────────────────
// WICHTIG (spezifisch vor allgemein): nur der bloße /data-Pfad. Sonst würde
// dieser Handler /data/restore verschlucken und den Restore-Body als kompletten
// app_data-Content speichern (Totalverlust des States).
if ($method === 'POST' && empty($parts[1] ?? null)) {
    // L5-DEP: Im Schema-First-Modus sind Blob-Writes depreciert.
    if (FORCE_SCHEMA) {
        http_response_code(410);
        header('Content-Type: application/json');
        echo json_encode([
            'error'   => 'Blob-Writes sind depreciert (FORCE_SCHEMA=true). Bitte die relationalen Endpoints verwenden.',
            'status'  => 410,
            'migrate' => 'Setze VITE_USE_SCHEMA=true im Frontend-Build.',
        ]);
        exit;
    }

    // 120 Saves pro Minute pro IP – grob 2/Sek; reicht für aktive Nutzer
    rate_limit('data_save', 120, 60);

    // Größencheck *vor* file_get_contents (verhindert OOM bei riesigem Body)
    $declaredLen = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($declaredLen > 10 * 1024 * 1024) error('Daten zu groß (max 10 MB)', 413);

    $raw = file_get_contents('php://input', false, null, 0, 10 * 1024 * 1024 + 1);
    if (empty($raw))                         error('Kein Inhalt', 400);
    if (strlen($raw) > 10 * 1024 * 1024)     error('Daten zu groß (max 10 MB)', 413);

    // Validierung: muss gültiges JSON-Objekt sein (nicht Array, nicht Skalar)
    $parsed = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) error('Ungültiges JSON', 400);
    if (!is_array($parsed))                    error('JSON muss Objekt sein', 400);

    // ── J2: Conflict-Detection via If-Match ──────────────────
    //    Frontend sendet seine bekannte Version mit. Wenn der
    //    Server inzwischen eine neuere Version hat, antworten
    //    wir 409 + aktuellen State, damit das Frontend mergen
    //    oder neu laden kann. Force-Override mit "*".
    $ifMatch = $_SERVER['HTTP_IF_MATCH'] ?? null;
    // ── J2-Härtung (Tier-1-Fund 02.07.): kein blinder Overwrite ohne Version ──
    //    Ein frischer Client, der nie GET /data gemacht hat (keine bekannte Version,
    //    kein If-Match), würde sonst den geteilten Server-Blob mit seinem lokalen
    //    Seed überschreiben (real passiert: Registrier-Flow nukte das Projekt des
    //    Ausbilders). Erst-Anlage (leerer app_data) bleibt erlaubt; bewusster
    //    Override weiterhin via If-Match: * (forceSave).
    // ── Bug-Hunt 08-06 #3: Prüfung UND Schreibvorgang in EINER Transaktion ──
    //    Vorher lagen zwischen „SELECT Version" und „INSERT … ON DUPLICATE KEY UPDATE"
    //    die K2-Diff-Validierung und ein weiterer SELECT. Zwei überlappende POSTs lasen
    //    beide dieselbe Version, bestanden beide die If-Match-Prüfung und schrieben
    //    nacheinander — kein 409, letzter gewinnt, die erste Änderung war weg.
    //    `SELECT … FOR UPDATE` serialisiert die Blob-Zeile jetzt über den gesamten
    //    Vorgang; der K2-Diff arbeitet damit ebenfalls auf einem stabilen Stand.
    // Die Diff-Validierungen unten beenden das Skript per error() → exit; ein catch
    // greift dort nicht. PDO rollt beim Verbindungsende zwar ohnehin zurück (keine
    // persistenten Verbindungen), aber die Zeilensperre soll sofort fallen.
    register_shutdown_function(static function () {
        try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $ignore) {}
    });

    db()->beginTransaction();
    try {
        $cur = db()->query('SELECT content, version, updated_at FROM app_data WHERE id = 1 FOR UPDATE')->fetch();
        $serverVersion = $cur ? data_version_of($cur) : 0;

        // ── J2-Härtung (Tier-1-Fund 02.07.): kein blinder Overwrite ohne Version ──
        //    Ein frischer Client, der nie GET /data gemacht hat (keine bekannte Version,
        //    kein If-Match), würde sonst den geteilten Server-Blob mit seinem lokalen
        //    Seed überschreiben (real passiert: Registrier-Flow nukte das Projekt des
        //    Ausbilders). Erst-Anlage (leerer app_data) bleibt erlaubt; bewusster
        //    Override weiterhin via If-Match: * (forceSave).
        $clientVersion = ($ifMatch !== null && $ifMatch !== '*') ? (int) trim($ifMatch, '"') : 0;
        $versionMismatch = $ifMatch === null
            ? $serverVersion > 0
            : ($ifMatch !== '*' && $serverVersion > 0 && $serverVersion !== $clientVersion);

        if ($versionMismatch) {
            $server = $cur ? json_decode($cur['content'], true) : [];
            db()->rollBack();
            header('ETag: "' . $serverVersion . '"');
            respond([
                'error'           => 'Conflict',
                'server_version'  => $serverVersion,
                'client_version'  => $clientVersion,
                'server_data'     => $server,
            ], 409);
        }

        // ── K2 (Sprint 10): Field-Level Permissions server-side ──
        //    Frontend blockt Edit/Delete schon, aber API muss auch rejecten,
        //    falls jemand direkt POSTet. Limitierung: Reports leben aktuell
        //    als JSON-Blob (L5 Schema-Refactor kommt in Sprint 12), daher
        //    Diff-Validation auf Blob-Ebene.
        if (($auth['role'] ?? 'azubi') !== 'ausbilder') {
            $oldData = $cur ? (json_decode($cur['content'], true) ?: []) : [];
            validate_reports_diff($parsed['reports'] ?? [], $oldData['reports'] ?? [], (int)$auth['sub']);
            // Gruppen-Mutationen sind Ausbilder-Sache; Azubi darf nur die EIGENE Beitritts-Anfrage
            // stellen/zurückziehen (Bug-Hunt GR-F1: sonst RLS-Bypass via Self-Add in members).
            validate_groups_diff($parsed['groups'] ?? [], $oldData['groups'] ?? [], (string)$auth['sub']);
            // Bug-Hunt 08-06 #7: Papierkorb ist für JEDE Nicht-Ausbilder-Rolle tabu.
            // `purgeFromTrash` (endgültiges Löschen) war ausschließlich im UI hinter
            // `isAusbilder` versteckt — serverseitig konnte ein Azubi den soft-gelöschten
            // Bericht eines anderen per direktem POST unwiderruflich entfernen.
            validate_trash_diff($parsed['trash'] ?? null, $oldData['trash'] ?? null, $parsed);

            // Bug-Hunt 3 #1 (Server): Mentor ist read-only Staff. reports/groups
            // sind oben schon abgedeckt; hier die restlichen Schreib-Sektionen gegen
            // den alten Blob abgleichen (tasks/materials/requirements liegen in
            // projects). Stale-POSTs sind durch die 409-Versionsprüfung oben
            // ausgeschlossen, daher ist der Sektions-Vergleich verlässlich.
            // Bug-Hunt 08-06 #7: `trash` und `activityLog` fehlten in dieser Liste,
            // obwohl beide reguläre Blob-Sektionen sind — ein „read-only" Mentor konnte
            // damit den Papierkorb leeren und das Aktivitätsprotokoll löschen.
            // `flashcards` steht bewusst weiter drin (Blob-Sektion ohne Zod-Schema).
            if (($auth['role'] ?? '') === 'mentor') {
                foreach (['projects','calendarEvents','trainingPlan','learningPaths','pathProgress','quizzes','flashcards','trash','activityLog'] as $sec) {
                    if (json_encode($parsed[$sec] ?? null) !== json_encode($oldData[$sec] ?? null)) {
                        db()->rollBack();
                        error('Mentoren haben nur Lesezugriff', 403);
                    }
                }
            }
        }

        $stmt = db()->prepare("
            INSERT INTO app_data (id, content, version) VALUES (1, ?, 1)
            ON DUPLICATE KEY UPDATE content = VALUES(content), version = version + 1, updated_at = NOW()
        ");
        $stmt->execute([$raw]);
        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) { try { db()->rollBack(); } catch (Throwable $ignore) {} }
        throw $e;
    }

    // L4: Rollendes Tages-Backup — erster Save am Tag wird als Snapshot
    //     gespeichert (INSERT IGNORE = bei vorhandenem Tagessatz nichts).
    //     Retention: 30 Tage automatisch aufräumen.
    try {
        $today = date('Y-m-d');
        db()->prepare(
            "INSERT IGNORE INTO app_data_history (snapshot_day, content, size_bytes)
             VALUES (?, ?, ?)"
        )->execute([$today, $raw, strlen($raw)]);
        // GC nur gelegentlich (jeder 50. Call)
        if (mt_rand(1, 50) === 1) {
            db()->exec("DELETE FROM app_data_history WHERE snapshot_day < (CURRENT_DATE - INTERVAL 30 DAY)");
        }
    } catch (Throwable $e) { /* Backup darf den Save nicht blocken */ }

    // ── L5-5 (Sprint 12 P2-3): Dual-Write ────────────────────
    //    Hinter Feature-Flag BACKEND_DUAL_WRITE spiegelt der Save den Blob
    //    insert-only (idempotent) in die relationalen Tabellen. Der Blob ist
    //    und bleibt Source-of-Truth: ein Fehler beim Sync darf den bereits
    //    gespeicherten Blob NIE zurückrollen → alles in try/catch, Tabellen-
    //    Schema wird vorab geprüft (fehlt es, wird still übersprungen).
    if (BACKEND_DUAL_WRITE) {
        try {
            require_once dirname(__DIR__, 2) . '/database/migration_helpers.php';
            migration_check_required_tables(db(), [
                'users', 'groups', 'group_members', 'projects', 'project_assignments',
                'tasks', 'requirements', 'materials', 'reports',
                'quizzes', 'quiz_questions', 'quiz_answers',
                'learning_paths', 'learning_path_nodes', 'learning_path_edges', 'learning_path_progress',
                'time_entries', 'calendar_events', 'report_files',
            ]);
            migration_ensure_map_table(db());
            $dwStats = migrate_blob_entities(db(), $parsed, false);

            // L5-6b: Audit-Eintrag pro Save, wenn der Dual-Write relational
            // tatsächlich neue Datensätze angelegt hat (nicht nur Blob-Mutation).
            $dwInserted = 0;
            foreach ($dwStats as $sk => $sv) { if ($sk !== 'skipped') $dwInserted += (int)$sv; }
            if ($dwInserted > 0) {
                audit_ensure_table(db());
                audit_log_write(db(), $auth, 'data.dual_write', [
                    'entity_type' => 'data',
                    'action'      => "dual-write: {$dwInserted} Datensätze relational angelegt",
                    'meta'        => $dwStats,
                ]);
            }
        } catch (Throwable $e) {
            // Offene Projekt-Transaktion defensiv schließen, Fehler nur loggen.
            if (db()->inTransaction()) { try { db()->rollBack(); } catch (Throwable $ignore) {} }
            error_log('[data.php] Dual-Write übersprungen/fehlgeschlagen: ' . $e->getMessage());
        }
    }

    // Neue Version zurückgeben
    $row = db()->query('SELECT version, updated_at FROM app_data WHERE id = 1')->fetch();
    $newVersion = $row ? data_version_of($row) : time();
    header('ETag: "' . $newVersion . '"');
    header('X-Data-Version: ' . $newVersion);
    respond(['ok' => true, 'version' => $newVersion]);
}

// ── GET /api/data/backups/{day} ──────────────────────────────
// L4: Snapshot eines bestimmten Tages laden (nur Ausbilder)
if ($method === 'GET' && (($parts[1] ?? null) === 'backups') && !empty($parts[2])) {
    require_role('ausbilder');
    $day = $parts[2];
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) error('Ungültiges Datum', 400);

    $stmt = db()->prepare('SELECT content FROM app_data_history WHERE snapshot_day = ? LIMIT 1');
    $stmt->execute([$day]);
    $row = $stmt->fetch();
    if (!$row) error('Snapshot nicht gefunden', 404);

    $data = json_decode($row['content'], true);
    respond($data);
}

// ── GET /api/data/backups ────────────────────────────────────
// L4: Liste aller verfügbaren Snapshots (nur Ausbilder)
if ($method === 'GET' && (($parts[1] ?? null) === 'backups')) {
    require_role('ausbilder');
    $rows = db()->query(
        'SELECT snapshot_day, created_at, size_bytes
         FROM app_data_history
         ORDER BY snapshot_day DESC'
    )->fetchAll();
    respond($rows);
}

// ── POST /api/data/restore ───────────────────────────────────
// L4: Restore aus Snapshot (nur Ausbilder, mit Sicherheits-Snapshot davor)
if ($method === 'POST' && (($parts[1] ?? null) === 'restore')) {
    require_role('ausbilder');
    $b   = body();
    $day = $b['snapshot_day'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) error('Ungültiges Datum', 400);

    $stmt = db()->prepare('SELECT content FROM app_data_history WHERE snapshot_day = ? LIMIT 1');
    $stmt->execute([$day]);
    $snap = $stmt->fetch();
    if (!$snap) error('Snapshot nicht gefunden', 404);

    // Bug-Hunt 3 #14: echten Pre-Restore-Snapshot des AKTUELLEN Stands anlegen,
    // bevor er überschrieben wird. Der Save-Pfad snapshottet nur den ERSTEN
    // Save des Tages (INSERT IGNORE) → ohne das hier ginge ein seither
    // geänderter Stand beim Restore verloren. ON DUPLICATE = jüngster Stand gewinnt.
    $cur = db()->query('SELECT content FROM app_data WHERE id = 1')->fetch();
    if ($cur) {
        db()->prepare(
            "INSERT INTO app_data_history (snapshot_day, content, size_bytes) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content), size_bytes = VALUES(size_bytes)"
        )->execute([date('Y-m-d'), $cur['content'], strlen($cur['content'])]);
    }

    db()->prepare("
        INSERT INTO app_data (id, content, version) VALUES (1, ?, 1)
        ON DUPLICATE KEY UPDATE content = VALUES(content), version = version + 1, updated_at = NOW()
    ")->execute([$snap['content']]);

    $row = db()->query('SELECT version, updated_at FROM app_data WHERE id = 1')->fetch();
    $newVersion = $row ? data_version_of($row) : time();
    header('ETag: "' . $newVersion . '"');
    respond(['ok' => true, 'version' => $newVersion, 'restored_from' => $day]);
}

error('Methode nicht erlaubt', 405);

// ── Versions-Helfer (Bug-Hunt 08-06 #2) ──────────────────────
//   Liest den Versions-Zähler aus einer app_data-Zeile. Fällt auf
//   UNIX_TIMESTAMP(updated_at) zurück, falls die Spalte auf einer alten
//   Installation (noch) fehlt oder auf 0 steht — so bleibt die Version auch
//   dann monoton und die laufenden Clients laufen nicht in Pseudo-Konflikte.
function data_version_of(array $row): int {
    $v = (int)($row['version'] ?? 0);
    if ($v > 0) return $v;
    return isset($row['updated_at']) ? (int)strtotime($row['updated_at']) : 0;
}

// ── Papierkorb-Diff (Bug-Hunt 08-06 #7) ──────────────────────
//   Endgültiges Löschen aus dem Papierkorb (purgeFromTrash) ist Ausbilder-Sache
//   und war NUR im UI abgesichert. Serverseitig durfte jede Rolle Einträge aus
//   `trash` entfernen — auch fremde, soft-gelöschte Berichte, unwiderruflich.
//   Geprüft wird ausschließlich das PURGE. Zwei legitime Wege entfernen ebenfalls
//   Einträge aus `trash` und müssen für alle Rollen erlaubt bleiben:
//     - Wiederherstellen (restoreFromTrash): der Eintrag taucht in seiner Zielsektion
//       wieder auf (goals liegen in trainingPlan.goals).
//     - Auto-Cleanup (autoCleanTrash, läuft bei JEDEM Login): Einträge älter als 30 Tage.
//   Alles andere ist ein endgültiges Löschen und damit Ausbilder-Sache.
function validate_trash_diff($newTrash, $oldTrash, array $newData): void {
    if (!is_array($oldTrash)) return;   // vorher kein Papierkorb → nichts zu schützen
    if (!is_array($newTrash)) $newTrash = [];
    $maxAge = 30 * 86400;

    foreach ($oldTrash as $cat => $oldEntries) {
        if (!is_array($oldEntries)) continue;
        $newEntries = is_array($newTrash[$cat] ?? null) ? $newTrash[$cat] : [];
        $stillInBin = [];
        foreach ($newEntries as $e) { if (isset($e['id'])) $stillInBin[(string)$e['id']] = true; }

        // Zielsektion für den Restore-Fall
        $target = $cat === 'goals'
            ? (is_array($newData['trainingPlan']['goals'] ?? null) ? $newData['trainingPlan']['goals'] : [])
            : (is_array($newData[$cat] ?? null) ? $newData[$cat] : []);
        $restored = [];
        foreach ($target as $e) { if (isset($e['id'])) $restored[(string)$e['id']] = true; }

        foreach ($oldEntries as $e) {
            if (!isset($e['id'])) continue;
            $id = (string)$e['id'];
            if (isset($stillInBin[$id]) || isset($restored[$id])) continue;   // bleibt / wiederhergestellt
            $deletedAt = isset($e['deletedAt']) ? strtotime((string)$e['deletedAt']) : false;
            if ($deletedAt !== false && (time() - $deletedAt) > $maxAge) continue;   // Auto-Cleanup nach 30 Tagen
            error('Nicht berechtigt: endgültiges Löschen aus dem Papierkorb ist Ausbildern vorbehalten', 403);
        }
    }
}

// ── Kanonische Form für den Report-Diff (Bug-Hunt 08-06 #6) ──
//   Sortiert assoziative Arrays rekursiv nach Schlüssel und serialisiert.
//   Damit ist der Vergleich vollständig (kein Feld fällt durch) und trotzdem
//   unabhängig von der Schlüsselreihenfolge, die ein JS-Client liefert.
function report_canon($v): string {
    return json_encode(report_canon_sort($v));
}
function report_canon_sort($v) {
    if (!is_array($v)) return $v;
    $out = [];
    foreach ($v as $k => $sub) $out[$k] = report_canon_sort($sub);
    if (!array_is_list($out)) ksort($out);
    return $out;
}

// ── K2 Helper (Sprint 10) ────────────────────────────────────
//   Vergleicht eingehenden Reports-Array mit dem alten Stand und
//   wirft 403, sobald ein Azubi/Mentor etwas tut, was er nicht darf:
//   - Report eines anderen Nutzers verändern/löschen
//   - Eigenen submitted/reviewed/signed Report editieren oder löschen
//   - Status auf reviewed/signed setzen (nur Ausbilder)
//   Bei Mentor ist user_id immer != $uid → jede Mutation wird geblockt.
//
//   WICHTIG: Funktion top-level deklarieren, NICHT in einem if-Block.
//   PHP registriert in-conditional-Funktionen erst zur Runtime — die
//   wird aber durch respond()/error() oben beendet, bevor sie hier
//   ankommt. Ein early-return false durch function_exists wäre zwar
//   defensiv, hat aber genau das Problem: würde nie ausgewertet.
function validate_reports_diff(array $newReports, array $oldReports, int $uid): void {
    $oldById = [];
    foreach ($oldReports as $r) {
        if (isset($r['id'])) $oldById[(string)$r['id']] = $r;
    }
    $seenIds = [];
    foreach ($newReports as $nr) {
        $id  = isset($nr['id']) ? (string)$nr['id'] : '';
        $seenIds[$id] = true;
        $owner = (int)($nr['user_id'] ?? 0);
        $status = $nr['status'] ?? 'draft';

        if (isset($oldById[$id])) {
            $or = $oldById[$id];
            // Bug-Hunt 08-06 #6: KEINE Whitelist mehr. Sie ist zweimal hinter dem
            // Report-Schema zurückgeblieben (schon Bug-Hunt 3 #9 musste sie nachziehen)
            // und fehlende Felder heißen hier „keine Änderung" → die Owner- und
            // Status-Prüfung darunter lief gar nicht erst an. Zuletzt fehlten `days`
            // (die IHK-Tagesstruktur, die beim Druck sogar Vorrang vor `activities` hat)
            // sowie sämtliche Signatur-/Zeitstempel-Felder: ein Azubi konnte damit den
            // Tagesbericht eines fremden, bereits SIGNIERTEN Nachweises umschreiben.
            // Jetzt zählt jede Abweichung — Vergleich reihenfolge-unabhängig kanonisiert,
            // damit ein bloßer Key-Reshuffle des Clients keinen Fehlalarm auslöst.
            if (report_canon($or) === report_canon($nr)) continue;

            $isOwner   = (int)($or['user_id'] ?? 0) === $uid;
            $oldStatus = $or['status'] ?? 'draft';

            if (!$isOwner) error('Nicht berechtigt: Report eines anderen Nutzers geändert', 403);
            // user_id darf nicht verändert werden — sonst könnte Azubi seinen Report an andere übertragen
            if ($owner !== $uid) error('Nicht berechtigt: user_id eines bestehenden Reports verändert', 403);
            // Wenn nicht mehr im Draft, ist *keine* Änderung erlaubt (auch kein Status-Zurücksetzen).
            if ($oldStatus !== 'draft') {
                error('Eingereichter Report kann nicht mehr geändert werden', 403);
            }
            // Aus Draft darf nur in Draft bleiben oder eingereicht werden — alles andere ist Ausbilder-Sache.
            if (!in_array($status, ['draft','submitted'], true)) {
                error('Nur Ausbilder dürfen Status auf "geprüft" oder "unterschrieben" setzen', 403);
            }
        } else {
            // Neuer Report
            if ($owner !== $uid) error('Nicht berechtigt: Neuer Report mit fremder user_id', 403);
            if (!in_array($status, ['draft','submitted'], true)) {
                error('Neuer Report darf nur Entwurf oder Eingereicht sein', 403);
            }
        }
    }
    // Gelöschte Reports
    foreach ($oldReports as $or) {
        $id = isset($or['id']) ? (string)$or['id'] : '';
        if (isset($seenIds[$id])) continue;
        $isOwner = (int)($or['user_id'] ?? 0) === $uid;
        $status  = $or['status'] ?? 'draft';
        if (!$isOwner) error('Nicht berechtigt: Report eines anderen Nutzers gelöscht', 403);
        if ($status !== 'draft') error('Eingereichter Report kann nicht gelöscht werden', 403);
    }
}

// ── Gruppen-Diff-Validierung (GR-F1, 2026-06-10) ─────────────
// Nicht-Ausbilder dürfen am groups-Array NUR die eigene Beitritts-Anfrage
// stellen/zurückziehen. Alles andere (Gruppen anlegen/löschen/umbenennen,
// members ändern, fremde requests anfassen) → 403. IDs typtolerant als String
// vergleichen (localStorage-Modus speichert Strings, API-Modus Integer).
function validate_groups_diff(array $newGroups, array $oldGroups, string $uid): void {
    $norm = static function ($arr): array {
        $out = [];
        foreach ((array)$arr as $v) $out[] = (string)$v;
        sort($out);
        return $out;
    };

    $oldById = [];
    foreach ($oldGroups as $g) {
        if (isset($g['id'])) $oldById[(string)$g['id']] = $g;
    }

    // Set der neuen IDs bilden — Duplikate und leere IDs sind verboten und die ID-Menge muss
    // EXAKT der alten entsprechen. Der frühere reine count-Check ließ sich umgehen: [A,A] hat
    // dieselbe Anzahl wie [A,B], passiert den Count, und die per-Gruppe-Schleife vergleicht beide
    // A-Kopien nur gegen oldById[A] (identisch) → B wird samt members/requests still gelöscht.
    $newIds = [];
    foreach ($newGroups as $ng) {
        $gid = isset($ng['id']) ? (string)$ng['id'] : '';
        if ($gid === '' || in_array($gid, $newIds, true)) {
            error('Nicht berechtigt: Gruppen anlegen/löschen ist Ausbilder-Sache', 403);
        }
        $newIds[] = $gid;
    }
    $oldIds = array_keys($oldById);
    sort($newIds);
    sort($oldIds);
    if ($newIds !== $oldIds) {
        error('Nicht berechtigt: Gruppen anlegen/löschen ist Ausbilder-Sache', 403);
    }

    foreach ($newGroups as $ng) {
        $id = isset($ng['id']) ? (string)$ng['id'] : '';
        if (!isset($oldById[$id])) {
            error('Nicht berechtigt: Gruppen anlegen/löschen ist Ausbilder-Sache', 403);
        }
        $og = $oldById[$id];

        // Stammdaten + Mitglieder müssen identisch bleiben
        if (($ng['name'] ?? null) !== ($og['name'] ?? null) || ($ng['type'] ?? null) !== ($og['type'] ?? null)) {
            error('Nicht berechtigt: Gruppen-Stammdaten geändert', 403);
        }
        if ($norm($ng['members'] ?? []) !== $norm($og['members'] ?? [])) {
            error('Nicht berechtigt: Gruppen-Mitglieder dürfen nur Ausbilder ändern', 403);
        }

        // requests: symmetrische Differenz darf höchstens die eigene ID sein
        $oldReq = $norm($og['requests'] ?? []);
        $newReq = $norm($ng['requests'] ?? []);
        $added   = array_diff($newReq, $oldReq);
        $removed = array_diff($oldReq, $newReq);
        foreach (array_merge($added, $removed) as $rid) {
            if ($rid !== $uid) {
                error('Nicht berechtigt: fremde Beitritts-Anfragen geändert', 403);
            }
        }
    }
}
