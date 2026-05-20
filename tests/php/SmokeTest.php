<?php

declare(strict_types=1);

namespace AzubiBoard\Tests;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\CoversNothing;

#[CoversNothing]
final class SmokeTest extends TestCase
{
    public function testPhpVersionMeetsRequirement(): void
    {
        $this->assertTrue(
            version_compare(PHP_VERSION, '8.2.0', '>='),
            'AzubiBoard verlangt PHP 8.2+. Gefunden: ' . PHP_VERSION
        );
    }

    public function testRequiredExtensionsAreLoaded(): void
    {
        foreach (['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl'] as $ext) {
            $this->assertTrue(extension_loaded($ext), "Extension fehlt: {$ext}");
        }
    }

    public function testProjectRootConstantsAreSet(): void
    {
        $this->assertTrue(defined('AZUBI_ROOT'));
        $this->assertTrue(defined('AZUBI_API'));
        $this->assertDirectoryExists(AZUBI_ROOT);
        $this->assertDirectoryExists(AZUBI_API);
    }

    public function testApiConfigLoadsWithTestEnv(): void
    {
        // Sicherheitsnetz: config.php DARF nicht crashen wenn JWT_SECRET via env gesetzt ist
        // (phpunit.xml setzt JWT_SECRET als Env-Var force=true)
        $this->assertNotFalse(getenv('JWT_SECRET'), 'phpunit.xml muss JWT_SECRET via env force=true setzen');
        $this->assertSame('test', getenv('APP_ENV'));

        require_once AZUBI_API . '/config.php';

        $this->assertTrue(defined('JWT_SECRET'));
        $this->assertTrue(defined('DB_NAME'));
        $this->assertSame('azubiboard_test', DB_NAME, 'Test-DB-Name muss aus phpunit.xml kommen, nicht .env');
    }

    public function testMigrationScriptIsCliOnly(): void
    {
        $path = AZUBI_ROOT . '/database/migrate_blob_to_relational.php';
        $this->assertFileExists($path);
        $code = file_get_contents($path);
        $this->assertStringContainsString('PHP_SAPI', $code, 'Migration-Script muss CLI-Guard haben');
        $this->assertStringContainsString('403 Forbidden', $code, 'Web-Aufruf muss geblockt werden');
    }
}
