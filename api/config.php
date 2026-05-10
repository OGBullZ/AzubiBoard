<?php
// ============================================================
//  AzubiBoard – Konfiguration (liest aus .env)
//  Nie Secrets direkt hier eintragen!
// ============================================================

// ── .env einlesen (nur wenn noch nicht über Server-Umgebung gesetzt) ──
$envFile = dirname(__DIR__) . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k); $v = trim($v, " \t\n\r\0\x0B\"'");
        if (!array_key_exists($k, $_ENV) && !array_key_exists($k, $_SERVER)) {
            putenv("$k=$v"); $_ENV[$k] = $v;
        }
    }
}

function env(string $key, mixed $default = null): mixed {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

// ── Konfigurationswerte ──────────────────────────────────────
define('DB_HOST',    env('DB_HOST',    'localhost'));
define('DB_PORT',    (int) env('DB_PORT', 3306));
define('DB_NAME',    env('DB_NAME',    'azubiboard'));
define('DB_USER',    env('DB_USER',    'azubiboard_user'));
define('DB_PASS',    env('DB_PASS',    ''));
define('DB_CHARSET', 'utf8mb4');

// JWT_SECRET MUSS in .env gesetzt werden — kein sinnvoller Default
define('JWT_SECRET', env('JWT_SECRET') ?: throw new RuntimeException('JWT_SECRET nicht gesetzt'));
define('JWT_EXPIRY', (int) env('JWT_EXPIRY', 86400 * 7));

define('UPLOAD_DIR',  dirname(__DIR__) . '/uploads/');
define('MAX_FILE_MB', (int) env('MAX_FILE_MB', 10));

// In Produktion: exakte Domain, kein Wildcard
$origin = env('ALLOWED_ORIGIN', 'http://localhost:5173');
define('ALLOWED_ORIGIN', $origin);

define('APP_ENV', env('APP_ENV', 'production'));

// ── Datenbankverbindung ──────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
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
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === ALLOWED_ORIGIN) {
        header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type,Authorization');
    header('Content-Type: application/json; charset=UTF-8');
    // Security-Headers
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
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
    // Fehlerdetails nur in Development-Umgebung
    $body = ['error' => $msg];
    respond($body, $code);
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
    if (!$p || ($p['exp'] ?? 0) < time()) return null;
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

// ── Rate-Limiting ────────────────────────────────────────────
//  Datei-basiertes Sliding-Window pro IP+Route. Auf Shared-Hosting
//  ohne Redis ausreichend. Schreibt in sys_get_temp_dir()/azubiboard_rl/.
//
//  Usage: rate_limit('login', 5, 900);  // 5 Versuche pro 15 min pro IP
function client_ip(): string {
    // Vertrauen nur in REMOTE_ADDR (X-Forwarded-For ist trivial fälschbar).
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
function rate_limit(string $bucket, int $max, int $windowSec): void {
    $dir = sys_get_temp_dir() . '/azubiboard_rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);

    $key  = $bucket . '_' . hash('sha256', client_ip());
    $file = $dir . '/' . $key;
    $now  = time();
    $cutoff = $now - $windowSec;

    // File-Lock gegen Race-Conditions.
    $fp = @fopen($file, 'c+');
    if (!$fp) return; // failsafe: lieber durchlassen als crashen
    flock($fp, LOCK_EX);

    $hits = [];
    $contents = stream_get_contents($fp);
    if ($contents) {
        $decoded = json_decode($contents, true);
        if (is_array($decoded)) $hits = array_filter($decoded, fn($t) => is_int($t) && $t >= $cutoff);
    }

    if (count($hits) >= $max) {
        flock($fp, LOCK_UN); fclose($fp);
        // Retry-After in Sekunden: bis ältester Treffer aus Fenster fällt
        $oldest = min($hits);
        header('Retry-After: ' . max(1, ($oldest + $windowSec) - $now));
        error('Zu viele Anfragen – bitte später erneut versuchen', 429);
    }

    $hits[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($hits)));
    flock($fp, LOCK_UN);
    fclose($fp);

    // Gelegentliches GC: alte Bucket-Files entfernen
    if (mt_rand(1, 200) === 1) {
        foreach (glob($dir . '/*') as $f) {
            if (@filemtime($f) < $now - 86400) @unlink($f);
        }
    }
}

// ── Input-Validierung (length + type) ────────────────────────
function clean_str(mixed $v, int $max = 200, bool $required = true, string $field = 'Feld'): ?string {
    if ($v === null || $v === '') {
        if ($required) error("$field erforderlich", 400);
        return null;
    }
    if (!is_string($v)) error("$field muss Text sein", 400);
    $v = trim($v);
    if (mb_strlen($v) > $max) error("$field zu lang (max. $max Zeichen)", 400);
    return $v;
}
function clean_int(mixed $v, int $min, int $max, string $field = 'Wert'): int {
    if (!is_numeric($v)) error("$field muss eine Zahl sein", 400);
    $n = (int)$v;
    if ($n < $min || $n > $max) error("$field außerhalb des erlaubten Bereichs ($min–$max)", 400);
    return $n;
}
