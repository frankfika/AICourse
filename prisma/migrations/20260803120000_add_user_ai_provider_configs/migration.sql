CREATE TABLE `user_ai_provider_configs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `api_key_enc` TEXT NOT NULL,
  `model` VARCHAR(191) NOT NULL,
  `base_url` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_ai_provider_configs_user_id_provider_key` (`user_id`, `provider`),
  INDEX `user_ai_provider_configs_user_id_is_active_idx` (`user_id`, `is_active`),
  CONSTRAINT `user_ai_provider_configs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
