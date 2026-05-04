<?php
// ============================================================
//  AzubiBoard – API Router
// ============================================================
require_once __DIR__ . '/config.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$parts  = array_values(array_filter(explode('/', trim($uri, '/'))));

// Präfix /api entfernen
while (!empty($parts) && in_array($parts[0], ['api', 'v1'])) {
    array_shift($parts);
}

$resource = $parts[0] ?? '';
$id       = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
$sub      = $parts[2] ?? null;

try {
    match($resource) {
        'auth'  => require __DIR__ . '/routes/auth.php',
        'data'  => require __DIR__ . '/routes/data.php',
        'users' => require __DIR__ . '/routes/users.php',
        default => error("Unbekannte Route '$resource'", 404),
    };
} catch (PDOException $e) {
    // Keine DB-Details nach außen geben
    error('Datenbankfehler', 500);
} catch (Throwable $e) {
    $msg = APP_ENV === 'development' ? $e->getMessage() : 'Serverfehler';
    error($msg, 500);
}
