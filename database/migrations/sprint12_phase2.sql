-- ============================================================
--  Sprint 12 Phase 2 — Schema-Erweiterung
--  Voraussetzung: database/azubiboard.sql ist bereits importiert.
--  Idempotent für MariaDB 10.4+ (nutzt IF NOT EXISTS).
--
--  Quellen-Bezug:
--    docs/Sprint12-Migration.md — Lücken-Matrix Abschnitt A
--
--  Was diese Migration tut:
--    1. Lernpfade (Sprint 11 Feature) → 4 neue Tabellen
--    2. Soft-Delete (Sprint 5 J3) → deleted_at auf projects/reports/requirements
--    3. trainingPlan (Azubi-Profil) → users.training_plan JSON
-- ============================================================

-- ----- Lernpfade -----------------------------------------------

CREATE TABLE IF NOT EXISTS `learning_paths` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `lehrjahr` tinyint(3) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lp_lehrjahr` (`lehrjahr`),
  KEY `idx_lp_created_by` (`created_by`),
  CONSTRAINT `learning_paths_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `learning_path_nodes` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `path_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('article','link','quiz','task') NOT NULL DEFAULT 'article',
  `content` text DEFAULT NULL,
  `sort_order` smallint(5) UNSIGNED DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lpn_path` (`path_id`),
  CONSTRAINT `lpn_ibfk_path` FOREIGN KEY (`path_id`) REFERENCES `learning_paths` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `learning_path_edges` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `path_id` int(10) UNSIGNED NOT NULL,
  `from_node` int(10) UNSIGNED NOT NULL,
  `to_node` int(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lp_edge` (`path_id`,`from_node`,`to_node`),
  KEY `idx_lpe_from` (`from_node`),
  KEY `idx_lpe_to` (`to_node`),
  CONSTRAINT `lpe_ibfk_path` FOREIGN KEY (`path_id`) REFERENCES `learning_paths` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lpe_ibfk_from` FOREIGN KEY (`from_node`) REFERENCES `learning_path_nodes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lpe_ibfk_to`   FOREIGN KEY (`to_node`)   REFERENCES `learning_path_nodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `learning_path_progress` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED NOT NULL,
  `node_id` int(10) UNSIGNED NOT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lpp_user_node` (`user_id`,`node_id`),
  KEY `idx_lpp_node` (`node_id`),
  CONSTRAINT `lpp_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lpp_ibfk_node` FOREIGN KEY (`node_id`) REFERENCES `learning_path_nodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Soft-Delete (Sprint 5 J3 Papierkorb) ---------------------

ALTER TABLE `projects`     ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL;
ALTER TABLE `projects`     ADD INDEX IF NOT EXISTS `idx_projects_deleted` (`deleted_at`);

ALTER TABLE `reports`      ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL;
ALTER TABLE `reports`      ADD INDEX IF NOT EXISTS `idx_reports_deleted` (`deleted_at`);

ALTER TABLE `requirements` ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL;
ALTER TABLE `requirements` ADD INDEX IF NOT EXISTS `idx_requirements_deleted` (`deleted_at`);

-- ----- trainingPlan (JSON auf users) ----------------------------

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `training_plan` JSON DEFAULT NULL;
