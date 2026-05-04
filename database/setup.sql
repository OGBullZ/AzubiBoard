-- ============================================================
--  AzubiBoard – Datenbank-Setup
--  Ausführen: mysql -u root -p < database/setup.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS azubiboard
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Dedizierten Nutzer anlegen (root NICHT für die App verwenden)
CREATE USER IF NOT EXISTS 'azubiboard_user'@'localhost'
    IDENTIFIED BY 'PASSWORT_AENDERN';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE
    ON azubiboard.*
    TO 'azubiboard_user'@'localhost';
FLUSH PRIVILEGES;

USE azubiboard;

-- ── Nutzer ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name                  VARCHAR(100)     NOT NULL,
    email                 VARCHAR(255)     NOT NULL,
    password_hash         VARCHAR(255)     NOT NULL,   -- bcrypt
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── App-Daten (JSON-Blob) ────────────────────────────────────
-- Wird von api/routes/data.php automatisch angelegt,
-- hier zur Dokumentation:
CREATE TABLE IF NOT EXISTS app_data (
    id         INT UNSIGNED NOT NULL DEFAULT 1,
    content    LONGTEXT     NOT NULL,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Erster Ausbilder-Account ─────────────────────────────────
-- Passwort-Hash für "admin1234" (bcrypt cost 12):
-- In Produktion: Hash durch api/auth/register erzeugen lassen,
-- dann role auf 'ausbilder' setzen:
--   UPDATE users SET role='ausbilder' WHERE email='...';
