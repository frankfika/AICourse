-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_course_id_fkey`;

-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_user_id_fkey`;

-- DropIndex
DROP INDEX `reviews_course_id_created_at_idx` ON `reviews`;

-- DropIndex
DROP INDEX `reviews_course_id_helpful_idx` ON `reviews`;

-- AlterTable
ALTER TABLE `chapters` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `lessons` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `resources` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `reviews` DROP COLUMN `helpful`;

-- AlterTable
ALTER TABLE `user_provider_accounts` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `display_name` VARCHAR(191) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `is_primary` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `linked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `chat_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `lesson_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chat_sessions_user_id_lesson_id_idx`(`user_id`, `lesson_id`),
    INDEX `chat_sessions_user_id_updated_at_idx`(`user_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `tokens` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_session_id_created_at_idx`(`session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_events` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `lesson_id` VARCHAR(191) NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `position_sec` INTEGER NULL,
    `duration_ms` INTEGER NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `learning_events_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `learning_events_lesson_id_event_type_idx`(`lesson_id`, `event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `feature` VARCHAR(191) NOT NULL,
    `tokens_in` INTEGER NOT NULL DEFAULT 0,
    `tokens_out` INTEGER NOT NULL DEFAULT 0,
    `cost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_usage_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `ai_usage_feature_created_at_idx`(`feature`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `chapters_course_id_deleted_at_idx` ON `chapters`(`course_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `lessons_chapter_id_deleted_at_idx` ON `lessons`(`chapter_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `resources_lesson_id_deleted_at_idx` ON `resources`(`lesson_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `reviews_course_id_rating_idx` ON `reviews`(`course_id`, `rating`);

-- CreateIndex
CREATE INDEX `user_provider_accounts_user_id_deleted_at_idx` ON `user_provider_accounts`(`user_id`, `deleted_at`);

-- AddForeignKey
ALTER TABLE `chat_sessions` ADD CONSTRAINT `chat_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_sessions` ADD CONSTRAINT `chat_sessions_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_events` ADD CONSTRAINT `learning_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_events` ADD CONSTRAINT `learning_events_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage` ADD CONSTRAINT `ai_usage_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== P2 数据回填 (UserProviderAccount) ====================
-- 旧 P0-1 数据只有 created_at / updated_at,需要把它们迁到 linked_at / last_used_at
-- email_password 视为每个 user 的主登录方式
UPDATE `user_provider_accounts`
SET
  `linked_at` = `created_at`,
  `last_used_at` = `updated_at`
WHERE `linked_at` IS NULL OR `last_used_at` IS NULL;

-- email_password 标为 primary, 一个 user 只一个 primary
UPDATE `user_provider_accounts` SET `is_primary` = TRUE WHERE `provider` = 'email_password';

