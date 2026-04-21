<?php
// ============================================================
//  AzubiBoard – API Router
//  Datei: api/index.php
//  Pfad XAMPP: C:\xampp\htdocs\azubiboard\api\index.php
// ============================================================

require_once __DIR__ . '/config.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

// Pfad-Präfixe entfernen (z.B. /azubiboard/api/projects → projects)
$parts = array_values(array_filter(explode('/', $path)));
while (!empty($parts) && in_array($parts[0], ['azubiboard', 'api', 'v1'])) {
    array_shift($parts);
}

$resource = $parts[0] ?? '';
$id       = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
$sub      = $parts[2] ?? null;

try {
    match($resource) {
        'auth'          => require __DIR__ . '/routes/auth.php',
        'users'         => require __DIR__ . '/routes/users.php',
        'projects'      => require __DIR__ . '/routes/projects.php',
        'tasks'         => require __DIR__ . '/routes/tasks.php',
        'time'          => require __DIR__ . '/routes/time.php',
        'materials'     => require __DIR__ . '/routes/materials.php',
        'requirements'  => require __DIR__ . '/routes/requirements.php',
        'steps'         => require __DIR__ . '/routes/steps.php',
        'netzplan'      => require __DIR__ . '/routes/netzplan.php',
        'calendar'      => require __DIR__ . '/routes/calendar.php',
        'notifications' => require __DIR__ . '/routes/notifications.php',
        'reports'       => require __DIR__ . '/routes/reports.php',
        'groups'        => require __DIR__ . '/routes/groups.php',
        'learn'         => require __DIR__ . '/routes/learn.php',
        'uploads'       => require __DIR__ . '/routes/uploads.php',
        'untis'         => require __DIR__ . '/routes/untis.php',
        default         => error("Route '$resource' nicht gefunden", 404),
    };
} catch (PDOException $e) {
    error('Datenbankfehler: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error('Serverfehler: ' . $e->getMessage(), 500);
}
