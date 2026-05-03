<?php
// ============================================================
//  AzubiBoard – Konfiguration
//  Datei: api/config.php
//  Pfad XAMPP: C:\xampp\htdocs\azubiboard\api\config.php
// ============================================================

define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'azubiboard');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_CHARSET', 'utf8mb4');

define('JWT_SECRET', 'AENDERE_MICH_AzubiBoard_2026_XYZ_!');
define('JWT_EXPIRY', 86400 * 7);

define('UPLOAD_DIR',  __DIR__ . '/../uploads/');
define('MAX_FILE_MB', 10);
define('ALLOWED_ORIGIN', 'http://localhost:5173');

// ── Datenbankverbindung ──────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT
             . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ── CORS ─────────────────────────────────────────────────────
function cors(): void {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type,Authorization');
    header('Content-Type: application/json; charset=UTF-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204); exit;
    }
}

// ── Antworten ────────────────────────────────────────────────
function respond(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function error(string $msg, int $code = 400): never {
    respond(['error' => $msg], $code);
}

// ── Request-Body ─────────────────────────────────────────────
function body(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) error('Ungültiges JSON', 400);
    return $data ?? [];
}

// ── JWT ──────────────────────────────────────────────────────
function b64u(string $d): string {
    return rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
}
function jwt_create(array $payload): string {
    $h = b64u(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['exp'] = time() + JWT_EXPIRY;
    $payload['iat'] = time();
    $c = b64u(json_encode($payload));
    $s = b64u(hash_hmac('sha256', "$h.$c", JWT_SECRET, true));
    return "$h.$c.$s";
}
function jwt_verify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $c, $s] = $parts;
    if (!hash_equals(b64u(hash_hmac('sha256', "$h.$c", JWT_SECRET, true)), $s)) return null;
    $p = json_decode(base64_decode(strtr($c, '-_', '+/')), true);
    if (!$p || $p['exp'] < time()) return null;
    return $p;
}

// ── Auth ─────────────────────────────────────────────────────
function require_auth(): array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($h, 'Bearer ')) error('Nicht authentifiziert', 401);
    $p = jwt_verify(substr($h, 7));
    if (!$p) error('Token ungültig oder abgelaufen', 401);
    return $p;
}
function require_role(string ...$roles): array {
    $u = require_auth();
    if (!in_array($u['role'], $roles)) error('Keine Berechtigung', 403);
    return $u;
}

// ── Feldmapping Frontend <-> DB ───────────────────────────────
// Frontend-Statuswerte weichen vom DB-ENUM ab → hier mappen

function status_to_db(string $s): string {
    return match($s) {
        'in_progress' => 'in_progress',
        'blocked'     => 'blocked',
        'done'        => 'done',
        default       => 'open',   // not_started + waiting → open
    };
}

function status_from_db(string $s): string {
    return match($s) {
        'in_progress' => 'in_progress',
        'blocked'     => 'blocked',
        'done'        => 'done',
        default       => 'not_started',
    };
}

// Task-Datensatz für Frontend aufbereiten
function format_task(array $t): array {
    return [
        'id'           => (int)$t['id'],
        'project_id'   => (int)$t['project_id'],
        'text'         => $t['title'],           // DB: title  → Frontend: text
        'status'       => status_from_db($t['status'] ?? 'open'),
        'priority'     => $t['priority'] ?? 'medium',
        'assignee'     => $t['assigned_to'],     // DB: assigned_to → Frontend: assignee
        'deadline'     => $t['due_date'] ?? '',  // DB: due_date → Frontend: deadline
        'note'         => $t['note'] ?? '',
        'doc'          => $t['doc'] ?? '',
        'protocol'     => $t['protocol'] ?? '',
        'created'      => $t['created_at'] ?? '',
        'completed_at' => $t['completed_at'] ?? null,
        'assignee_name'=> $t['assignee_name'] ?? null,
        'sort_order'   => (int)($t['sort_order'] ?? 0),
    ];
}
