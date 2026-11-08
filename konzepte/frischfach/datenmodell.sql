-- =============================================================================
-- Frischfach – Datenmodell (Entwurf v1, Stand 2026-11-07)
-- MariaDB 10.6+ · InnoDB · utf8mb4
-- Konzept: siehe KONZEPT.md, Kapitel 9
--
-- Grundsätze
--  * Relational von Anfang an (Lehre aus AzubiBoard Sprint 12 / L5).
--  * Beträge in Cent (INT), Mengen als DECIMAL in Basiseinheit (g, ml, Stück).
--  * Kein Bon-Bild in der DB (wird nach der Extraktion gelöscht).
--  * Keine Zahlungsdaten, keine Kundenkartennummern.
--  * version-Spalte für Konflikterkennung bei gleichzeitigen Änderungen.
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- Nutzer und Haushalte
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255)    NOT NULL,
  password_hash  VARCHAR(255)    NOT NULL,
  totp_secret    VARBINARY(255)  NULL COMMENT 'verschlüsselt gespeichert, optional (2FA)',
  display_name   VARCHAR(80)     NOT NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE households (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80)     NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE household_members (
  household_id  BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  role          ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id, user_id),
  KEY ix_members_user (user_id),
  CONSTRAINT fk_members_household FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user      FOREIGN KEY (user_id)      REFERENCES users (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Stammdaten: Händler, Kategorien, Produkte
-- -----------------------------------------------------------------------------
CREATE TABLE stores (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chain_name       VARCHAR(80)     NOT NULL,
  tax_code_map     JSON            NULL COMMENT 'z. B. {"A":19,"B":7} – je Händler verschieden',
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stores_chain (chain_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id                     SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug                   VARCHAR(40)  NOT NULL COMMENT 'Schlüssel für die KI, z. B. gefluegel_roh',
  parent_id              SMALLINT UNSIGNED NULL,
  name                   VARCHAR(80)  NOT NULL,
  date_type              ENUM('mhd','verbrauchsdatum','keins') NOT NULL COMMENT 'typische Datumsart',
  requires_package_date  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = Verbrauchsdatum, nie schätzen',
  default_location       ENUM('kuehlschrank','gefrierfach','vorratsschrank','sonstiges') NOT NULL,
  unopened_days_min      SMALLINT UNSIGNED NULL,
  unopened_days_max      SMALLINT UNSIGNED NULL,
  opened_days_min        SMALLINT UNSIGNED NULL,
  opened_days_max        SMALLINT UNSIGNED NULL,
  freezer_days           SMALLINT UNSIGNED NULL,
  is_staple              TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Basics wie Salz/Öl – zählen für Rezepte als vorhanden',
  source_ref             VARCHAR(255) NULL COMMENT 'Quelle des Richtwerts (FoodKeeper-ID, VZ, BLE …)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id    BIGINT UNSIGNED NULL COMMENT 'NULL = globaler Katalog, sonst haushaltseigen',
  name            VARCHAR(120)    NOT NULL,
  category_id     SMALLINT UNSIGNED NOT NULL,
  gtin            VARCHAR(14)     NULL COMMENT 'EAN/GTIN, z. B. aus Open Food Facts',
  default_qty     DECIMAL(10,2)   NULL,
  default_unit    ENUM('piece','g','ml','pack') NULL,
  learned_shelf_days SMALLINT UNSIGNED NULL COMMENT 'aus Korrekturen gelernt (Haushalt)',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_products_gtin (gtin),
  KEY ix_products_household (household_id),
  CONSTRAINT fk_products_household FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category  FOREIGN KEY (category_id)  REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lernt Abkürzungen: "HAEH.BRUSTFIL.400G" (Händler X) -> Produkt "Hähnchenbrustfilet"
CREATE TABLE product_aliases (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id         BIGINT UNSIGNED NOT NULL,
  household_id     BIGINT UNSIGNED NULL COMMENT 'NULL = für alle (nur mit Einwilligung aggregiert)',
  raw_text_norm    VARCHAR(120)    NOT NULL COMMENT 'Großbuchstaben, ohne Preis/Menge, Leerzeichen vereinheitlicht',
  product_id       BIGINT UNSIGNED NOT NULL,
  hits             INT UNSIGNED    NOT NULL DEFAULT 1,
  last_used_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Hinweis: NULL in household_id macht den UNIQUE-Key für globale Aliase nicht eindeutig
  -- (MariaDB erlaubt mehrere NULL). Im Code per SELECT … FOR UPDATE absichern.
  UNIQUE KEY uq_alias (store_id, household_id, raw_text_norm),
  CONSTRAINT fk_alias_store     FOREIGN KEY (store_id)     REFERENCES stores (id),
  CONSTRAINT fk_alias_household FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_alias_product   FOREIGN KEY (product_id)   REFERENCES products (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Bons
-- -----------------------------------------------------------------------------
CREATE TABLE receipts (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id      BIGINT UNSIGNED NOT NULL,
  store_id          BIGINT UNSIGNED NULL,
  purchased_at      DATETIME        NULL,
  total_cents       INT             NULL,
  source            ENUM('photo','screenshot','ebon_pdf','manual') NOT NULL,
  fingerprint       CHAR(64)        NULL COMMENT 'SHA-256(store|purchased_at|total|tse_nr) gegen Doppel-Import',
  sum_check_ok      TINYINT(1)      NOT NULL DEFAULT 0,
  parse_model       VARCHAR(40)     NULL COMMENT 'welches Modell extrahiert hat (für Auswertung)',
  created_by        BIGINT UNSIGNED NOT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipts_fingerprint (household_id, fingerprint),
  KEY ix_receipts_household_date (household_id, purchased_at),
  CONSTRAINT fk_receipts_household FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_receipts_store     FOREIGN KEY (store_id)     REFERENCES stores (id),
  CONSTRAINT fk_receipts_user      FOREIGN KEY (created_by)   REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE receipt_lines (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_id        BIGINT UNSIGNED NOT NULL,
  line_no           SMALLINT UNSIGNED NOT NULL,
  raw_text          VARCHAR(255)    NOT NULL,
  line_type         ENUM('item','deposit','deposit_return','discount','non_food','info') NOT NULL,
  name_normalized   VARCHAR(120)    NULL,
  quantity          DECIMAL(10,2)   NULL,
  unit              ENUM('piece','g','ml','pack') NULL,
  unit_price_cents  INT             NULL,
  total_cents       INT             NOT NULL,
  tax_code          VARCHAR(4)      NULL,
  product_id        BIGINT UNSIGNED NULL,
  confidence        DECIMAL(3,2)    NULL,
  user_corrected    TINYINT(1)      NOT NULL DEFAULT 0,
  accepted          TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = in den Vorrat übernommen',
  PRIMARY KEY (id),
  UNIQUE KEY uq_lines_receipt_no (receipt_id, line_no),
  CONSTRAINT fk_lines_receipt FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE,
  CONSTRAINT fk_lines_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Vorrat
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id      BIGINT UNSIGNED NOT NULL,
  product_id        BIGINT UNSIGNED NOT NULL,
  receipt_line_id   BIGINT UNSIGNED NULL,
  quantity          DECIMAL(10,2)   NOT NULL,
  unit              ENUM('piece','g','ml','pack') NOT NULL,
  fill_level        TINYINT UNSIGNED NOT NULL DEFAULT 100 COMMENT 'Prozent für "teilweise" (25/50/75/100)',
  location          ENUM('kuehlschrank','gefrierfach','vorratsschrank','sonstiges') NOT NULL,
  purchased_on      DATE            NOT NULL,
  expires_on        DATE            NULL COMMENT 'effektives Datum nach Öffnen/Einfrieren',
  date_type         ENUM('mhd','verbrauchsdatum','keins') NOT NULL,
  date_source       ENUM('package','user','gs1','product_learned','category_estimate') NOT NULL,
  date_confidence   TINYINT UNSIGNED NOT NULL COMMENT '0–100',
  opened_at         DATETIME        NULL,
  frozen_at         DATETIME        NULL,
  thawed_at         DATETIME        NULL,
  status            ENUM('active','consumed','wasted','given_away') NOT NULL DEFAULT 'active',
  price_cents       INT             NULL,
  version           INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Optimistic Locking',
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Hauptabfrage: "Was läuft in den nächsten Tagen ab?"
  KEY ix_inventory_due (household_id, status, expires_on),
  CONSTRAINT fk_inv_household FOREIGN KEY (household_id)    REFERENCES households (id)    ON DELETE CASCADE,
  CONSTRAINT fk_inv_product   FOREIGN KEY (product_id)      REFERENCES products (id),
  CONSTRAINT fk_inv_line      FOREIGN KEY (receipt_line_id) REFERENCES receipt_lines (id) ON DELETE SET NULL,
  CONSTRAINT ck_inv_fill      CHECK (fill_level BETWEEN 0 AND 100),
  -- Verbrauchsdatum nie geschätzt (Regel 5.4 im Konzept)
  CONSTRAINT ck_inv_vd_source CHECK (date_type <> 'verbrauchsdatum' OR date_source IN ('package','user','gs1'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jede Änderung als Ereignis: Grundlage für Bilanz, Verbrauchsrhythmus und Lernen
CREATE TABLE inventory_events (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id       BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NULL,
  type          ENUM('added','opened','frozen','thawed','consumed','partial','wasted','given_away','date_changed','moved') NOT NULL,
  qty_delta     DECIMAL(10,2)   NULL,
  waste_reason  ENUM('verdorben','vergessen','zu_viel','schmeckt_nicht','sonstiges') NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_events_item (item_id, created_at),
  CONSTRAINT fk_events_item FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Einkaufsliste und Grundbestand
-- -----------------------------------------------------------------------------
CREATE TABLE par_levels (
  household_id  BIGINT UNSIGNED NOT NULL,
  product_id    BIGINT UNSIGNED NOT NULL,
  min_quantity  DECIMAL(10,2)   NOT NULL,
  PRIMARY KEY (household_id, product_id),
  CONSTRAINT fk_par_household FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_par_product   FOREIGN KEY (product_id)   REFERENCES products (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shopping_items (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id           BIGINT UNSIGNED NOT NULL,
  product_id             BIGINT UNSIGNED NULL,
  text                   VARCHAR(120)    NOT NULL,
  quantity               DECIMAL(10,2)   NULL,
  source                 ENUM('manual','par_level','rhythm','recipe') NOT NULL DEFAULT 'manual',
  checked_at             DATETIME        NULL,
  checked_by_receipt_id  BIGINT UNSIGNED NULL COMMENT 'automatisch abgehakt durch Bon-Import',
  created_by             BIGINT UNSIGNED NULL,
  version                INT UNSIGNED    NOT NULL DEFAULT 1,
  created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_shopping_open (household_id, checked_at),
  CONSTRAINT fk_shop_household FOREIGN KEY (household_id)          REFERENCES households (id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_product   FOREIGN KEY (product_id)            REFERENCES products (id)   ON DELETE SET NULL,
  CONSTRAINT fk_shop_receipt   FOREIGN KEY (checked_by_receipt_id) REFERENCES receipts (id)   ON DELETE SET NULL,
  CONSTRAINT fk_shop_user      FOREIGN KEY (created_by)            REFERENCES users (id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Rezepte
-- -----------------------------------------------------------------------------
CREATE TABLE recipes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(120)    NOT NULL,
  minutes      SMALLINT UNSIGNED NOT NULL,
  servings     TINYINT UNSIGNED NOT NULL DEFAULT 2,
  vegetarian   TINYINT(1)      NOT NULL DEFAULT 0,
  source       ENUM('curated','ai','user') NOT NULL,
  license      VARCHAR(80)     NULL COMMENT 'Pflicht bei curated, z. B. "eigenes Rezept"',
  steps        TEXT            NOT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recipe_ingredients (
  recipe_id    BIGINT UNSIGNED   NOT NULL,
  category_id  SMALLINT UNSIGNED NOT NULL COMMENT 'Zutat über Kategorie, damit "Gouda" auch "Hartkäse" trifft',
  quantity     DECIMAL(10,2)     NULL,
  unit         ENUM('piece','g','ml','pack') NULL,
  optional     TINYINT(1)        NOT NULL DEFAULT 0,
  PRIMARY KEY (recipe_id, category_id),
  CONSTRAINT fk_ri_recipe   FOREIGN KEY (recipe_id)   REFERENCES recipes (id)    ON DELETE CASCADE,
  CONSTRAINT fk_ri_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Benachrichtigungen (Web Push)
-- -----------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  endpoint    VARCHAR(500)    NOT NULL,
  p256dh      VARCHAR(255)    NOT NULL,
  auth        VARCHAR(255)    NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_prefs (
  user_id       BIGINT UNSIGNED NOT NULL,
  digest_time   TIME            NOT NULL DEFAULT '17:30:00',
  digest_on     TINYINT(1)      NOT NULL DEFAULT 1,
  vd_eve_alert  TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Hinweis am Vortag bei Verbrauchsdatum',
  quiet_from    TIME            NULL,
  quiet_to      TIME            NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_prefs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Beispiel-Abfrage für den täglichen Digest (Kapitel 5.6)
-- -----------------------------------------------------------------------------
-- SELECT p.name, i.expires_on, i.date_type
--   FROM inventory_items i
--   JOIN products p ON p.id = i.product_id
--  WHERE i.household_id = ?
--    AND i.status = 'active'
--    AND (i.frozen_at IS NULL OR i.thawed_at IS NOT NULL)   -- Gefrorenes zählt nicht, Aufgetautes schon
--    AND i.expires_on <= CURRENT_DATE + INTERVAL 1 DAY
--  ORDER BY i.date_type = 'verbrauchsdatum' DESC, i.expires_on;
