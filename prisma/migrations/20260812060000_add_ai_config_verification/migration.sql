ALTER TABLE `ai_configs`
  ADD COLUMN `verified_at` DATETIME(3) NULL,
  ADD COLUMN `last_verify_error` TEXT NULL;
