<?php
// ============================================================
//  AzubiBoard – Demo-Daten Seeder
//  Ausführen via CLI:
//    php database/seed.php
//  ODER auf XAMPP:
//    C:\xampp\php\php.exe C:\xampp\htdocs\azubiboard\database\seed.php
//
//  SICHERHEIT: Direkter Webzugriff ist durch database/.htaccess gesperrt.
// ============================================================

// Kein direkter Webzugriff (Fallback falls .htaccess fehlt)
if (PHP_SAPI !== 'cli' && isset($_SERVER['HTTP_HOST'])) {
    http_response_code(403);
    die("403 Forbidden: Dieses Script darf nicht über den Browser aufgerufen werden.\n"
      . "Bitte via CLI ausführen: php database/seed.php\n");
}

// .env einlesen
$envFile = dirname(__DIR__) . '/.env';
if (!file_exists($envFile)) {
    die("FEHLER: .env nicht gefunden. Bitte zuerst deploy.bat ausführen.\n");
}
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
    [$k, $v] = explode('=', $line, 2);
    $k = trim($k); $v = trim($v, " \t\n\r\"'");
    if (!array_key_exists($k, $_ENV)) { putenv("$k=$v"); $_ENV[$k] = $v; }
}

$host    = $_ENV['DB_HOST']    ?? 'localhost';
$port    = (int)($_ENV['DB_PORT'] ?? 3306);
$db      = $_ENV['DB_NAME']    ?? 'azubiboard';
$user    = $_ENV['DB_USER']    ?? 'azubiboard_user';
$pass    = $_ENV['DB_PASS']    ?? '';

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("FEHLER: DB-Verbindung fehlgeschlagen: " . $e->getMessage() . "\n"
      . "Bitte DB_USER und DB_PASS in .env setzen.\n");
}

// ── Tabellen anlegen (falls nicht vorhanden) ─────────────────
$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        name                  VARCHAR(100)     NOT NULL,
        email                 VARCHAR(255)     NOT NULL,
        password_hash         VARCHAR(255)     NOT NULL,
        role                  ENUM('azubi','ausbilder') NOT NULL DEFAULT 'azubi',
        theme                 ENUM('dark','light')      NOT NULL DEFAULT 'dark',
        avatar_url            VARCHAR(500)     DEFAULT NULL,
        phone                 VARCHAR(50)      DEFAULT NULL,
        profession            VARCHAR(100)     DEFAULT NULL,
        apprenticeship_year   TINYINT UNSIGNED DEFAULT 1,
        hire_date             DATE             DEFAULT NULL,
        end_date              DATE             DEFAULT NULL,
        department_id         INT UNSIGNED     DEFAULT NULL,
        notifications_enabled TINYINT(1)       NOT NULL DEFAULT 1,
        is_active             TINYINT(1)       NOT NULL DEFAULT 1,
        last_login            DATETIME         DEFAULT NULL,
        created_at            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$pdo->exec("
    CREATE TABLE IF NOT EXISTS app_data (
        id         INT UNSIGNED NOT NULL DEFAULT 1,
        content    LONGTEXT     NOT NULL,
        updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── Demo-Nutzer ───────────────────────────────────────────────
// Passwort für alle Demo-Accounts: 1234
$hash = password_hash('1234', PASSWORD_BCRYPT, ['cost' => 12]);

$demos = [
    [
        'name'                => 'Max Ausbilder',
        'email'               => 'ausbilder@firma.de',
        'role'                => 'ausbilder',
        'profession'          => 'Softwareentwicklung',
        'apprenticeship_year' => 1,
    ],
    [
        'name'                => 'Anna Azubi',
        'email'               => 'anna@azubi.de',
        'role'                => 'azubi',
        'profession'          => 'Fachinformatik AE',
        'apprenticeship_year' => 2,
    ],
    [
        'name'                => 'Tom Trainee',
        'email'               => 'tom@azubi.de',
        'role'                => 'azubi',
        'profession'          => 'Fachinformatik SI',
        'apprenticeship_year' => 1,
    ],
];

$inserted = 0; $skipped = 0;
$stmt = $pdo->prepare("
    INSERT IGNORE INTO users (name, email, password_hash, role, profession, apprenticeship_year)
    VALUES (?, ?, ?, ?, ?, ?)
");

foreach ($demos as $d) {
    $stmt->execute([$d['name'], $d['email'], $hash, $d['role'], $d['profession'], $d['apprenticeship_year']]);
    if ($stmt->rowCount() > 0) $inserted++;
    else $skipped++;
    echo "  [{$d['role']}] {$d['name']} <{$d['email']}> → " . ($stmt->rowCount() > 0 ? "erstellt" : "bereits vorhanden") . "\n";
}

echo "\n✓ Seed abgeschlossen: $inserted erstellt, $skipped übersprungen.\n";
echo "  Login-Passwort für alle Demo-Accounts: 1234\n";
echo "\n  WICHTIG: Diese Datei nach dem Seeden löschen oder sperren!\n";
echo "  rm database/seed.php\n";
