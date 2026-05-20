<?php
// ============================================================
//  PHPUnit-Bootstrap (Sprint 12 Phase 0)
//
//  - Lädt Composer-Autoload (PSR-4: AzubiBoard\Tests\)
//  - Setzt Projekt-Root als globale Konstante (für api/config.php-Pfade)
//  - .env wird NICHT geladen — Tests laufen mit Env-Vars aus phpunit.xml
// ============================================================

declare(strict_types=1);

define('AZUBI_ROOT', dirname(__DIR__, 2));
define('AZUBI_API',  AZUBI_ROOT . '/api');

require_once AZUBI_ROOT . '/vendor/autoload.php';
